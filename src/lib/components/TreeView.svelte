<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { computeLayout } from '../layout'
  import { planner } from '../store.svelte'
  import { computeAggregates, getAncestorIds, getBreadcrumb, isDescendantOf } from '../tree'
  import { STATUS_BY_ID } from '../statuses'
  import type { DropPosition } from '../types'
  import DragGhost from './DragGhost.svelte'
  import TaskNode from './TaskNode.svelte'

  interface PendingNodeDrag {
    taskId: string
    pointerId: number
    startX: number
    startY: number
    active: boolean
  }

  interface PinchState {
    startDistance: number
    startScale: number
    startTranslateX: number
    startTranslateY: number
    startMidX: number
    startMidY: number
  }

  let viewport: HTMLDivElement
  let layout = $derived(computeLayout(planner.state))
  let aggregates = $derived(computeAggregates(planner.state))
  let selectedPath = $derived(
    new Set(
      planner.selectedTaskId ? getAncestorIds(planner.state, planner.selectedTaskId) : [],
    ),
  )

  const MIN_SCALE = 0.2
  const MAX_SCALE = 2.4

  let translateX = $state(0)
  let translateY = $state(0)
  let scale = $state(1)
  let autoFitted = false

  let panning = $state(false)
  let didPan = false
  let panPointerId: number | null = null
  let panStartX = 0
  let panStartY = 0
  let panStartTranslateX = 0
  let panStartTranslateY = 0
  const activePointers = new Map<number, { x: number; y: number }>()
  let pinch: PinchState | null = null

  let draggingId = $state<string | null>(null)
  let dropTargetId = $state<string | null>(null)
  let dropPosition = $state<DropPosition>('before')
  let ghostX = $state(0)
  let ghostY = $state(0)
  let pendingNodeDrag: PendingNodeDrag | null = null
  let removeNodeDragListeners: (() => void) | null = null

  let draggingTask = $derived(draggingId ? planner.state.tasks[draggingId] : undefined)
  let draggingBreadcrumb = $derived(
    draggingTask ? getBreadcrumb(planner.state, draggingTask.id).join(' › ') : '',
  )
  let ghostMeta = $derived(
    draggingBreadcrumb ||
      (draggingTask ? STATUS_BY_ID[draggingTask.status].label : ''),
  )

  function clampScale(value: number): number {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value))
  }

  function capturePointer(pointerId: number) {
    try {
      viewport?.setPointerCapture(pointerId)
    } catch {
      // The pointer may already be gone.
    }
  }

  function releasePointer(pointerId: number) {
    try {
      if (viewport?.hasPointerCapture(pointerId)) {
        viewport.releasePointerCapture(pointerId)
      }
    } catch {
      // Ignore stale capture state.
    }
  }

  function fitToView() {
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const margin = 56
    const nextScale = clampScale(
      Math.min(
        1.15,
        (rect.width - margin) / Math.max(1, layout.width),
        (rect.height - margin) / Math.max(1, layout.height),
      ),
    )
    scale = nextScale
    translateX = (rect.width - layout.width * nextScale) / 2
    translateY = (rect.height - layout.height * nextScale) / 2
  }

  function zoomAt(nextScale: number, clientX: number, clientY: number) {
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const pointX = clientX - rect.left
    const pointY = clientY - rect.top
    const worldX = (pointX - translateX) / scale
    const worldY = (pointY - translateY) / scale
    scale = clampScale(nextScale)
    translateX = pointX - worldX * scale
    translateY = pointY - worldY * scale
  }

  function zoomBy(factor: number) {
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    zoomAt(scale * factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.12 : 0.89
    zoomAt(scale * factor, event.clientX, event.clientY)
  }

  function startPinch() {
    if (!viewport) return
    const points = [...activePointers.values()]
    if (points.length < 2) return
    const [first, second] = points
    const rect = viewport.getBoundingClientRect()
    const distance = Math.max(
      1,
      Math.hypot(first.x - second.x, first.y - second.y),
    )
    pinch = {
      startDistance: distance,
      startScale: scale,
      startTranslateX: translateX,
      startTranslateY: translateY,
      startMidX: (first.x + second.x) / 2 - rect.left,
      startMidY: (first.y + second.y) / 2 - rect.top,
    }
    panning = false
    panPointerId = null
    didPan = true
    for (const pointerId of activePointers.keys()) capturePointer(pointerId)
  }

  function resumePan(pointerId: number) {
    const point = activePointers.get(pointerId)
    if (!point) {
      panning = false
      panPointerId = null
      return
    }
    panning = true
    panPointerId = pointerId
    panStartX = point.x
    panStartY = point.y
    panStartTranslateX = translateX
    panStartTranslateY = translateY
    didPan = true
    capturePointer(pointerId)
  }

  function handlePointerDown(event: PointerEvent) {
    if (!viewport) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (
      target?.closest(
        'button, a, input, select, textarea, label, summary, [role="button"]',
      )
    ) {
      return
    }

    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (activePointers.size === 1) {
      if (target?.closest('.tree-node')) {
        panning = false
        panPointerId = null
        didPan = false
      } else {
        panning = true
        panPointerId = event.pointerId
        didPan = false
        panStartX = event.clientX
        panStartY = event.clientY
        panStartTranslateX = translateX
        panStartTranslateY = translateY
        capturePointer(event.pointerId)
      }
    } else if (activePointers.size === 2) {
      startPinch()
    }
  }

  function handlePointerMove(event: PointerEvent) {
    const point = activePointers.get(event.pointerId)
    if (!point) return
    point.x = event.clientX
    point.y = event.clientY

    if (pinch && activePointers.size >= 2) {
      if (!viewport) return
      const [first, second] = [...activePointers.values()]
      const rect = viewport.getBoundingClientRect()
      const distance = Math.max(
        1,
        Math.hypot(first.x - second.x, first.y - second.y),
      )
      const nextScale = clampScale(
        pinch.startScale * (distance / pinch.startDistance),
      )
      const midX = (first.x + second.x) / 2 - rect.left
      const midY = (first.y + second.y) / 2 - rect.top
      const worldX = (pinch.startMidX - pinch.startTranslateX) / pinch.startScale
      const worldY = (pinch.startMidY - pinch.startTranslateY) / pinch.startScale
      scale = nextScale
      translateX = midX - worldX * nextScale
      translateY = midY - worldY * nextScale
      return
    }

    if (!panning || event.pointerId !== panPointerId) return
    const deltaX = event.clientX - panStartX
    const deltaY = event.clientY - panStartY
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) didPan = true
    translateX = panStartTranslateX + deltaX
    translateY = panStartTranslateY + deltaY
  }

  function handlePointerUp(event: PointerEvent) {
    if (!activePointers.has(event.pointerId)) return
    releasePointer(event.pointerId)
    activePointers.delete(event.pointerId)

    if (pinch) {
      if (activePointers.size < 2) {
        pinch = null
        if (activePointers.size === 1) {
          resumePan([...activePointers.keys()][0])
        } else {
          panning = false
          panPointerId = null
        }
      }
      return
    }

    if (!panning || event.pointerId !== panPointerId) return
    panning = false
    panPointerId = null
    if (!didPan) planner.selectTask(null)
  }

  function handlePointerCancel(event: PointerEvent) {
    if (!activePointers.has(event.pointerId)) return
    releasePointer(event.pointerId)
    activePointers.delete(event.pointerId)
    if (activePointers.size < 2) pinch = null
    if (event.pointerId === panPointerId) {
      panning = false
      panPointerId = null
    }
  }

  function nodeAtPoint(
    clientX: number,
    clientY: number,
  ): { id: string; element: HTMLElement } | null {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    const nodeElement = element?.closest<HTMLElement>('.tree-node[data-task-id]')
    const id = nodeElement?.dataset.taskId
    return nodeElement && id ? { id, element: nodeElement } : null
  }

  function dropPositionFor(element: HTMLElement, clientY: number): DropPosition {
    const rect = element.getBoundingClientRect()
    const relative = (clientY - rect.top) / Math.max(1, rect.height)
    if (relative < 0.3) return 'before'
    if (relative > 0.7) return 'after'
    return 'inside'
  }

  function autoPanTree(clientX: number, clientY: number) {
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const edge = 54
    const step = 12
    if (clientX < rect.left + edge) translateX += step
    else if (clientX > rect.right - edge) translateX -= step
    if (clientY < rect.top + edge) translateY += step
    else if (clientY > rect.bottom - edge) translateY -= step
  }

  function updateNodeDropTarget(clientX: number, clientY: number) {
    if (!draggingId) return
    const hit = nodeAtPoint(clientX, clientY)
    if (!hit || hit.id === draggingId) {
      dropTargetId = null
      return
    }
    const dragged = planner.state.tasks[draggingId]
    const target = planner.state.tasks[hit.id]
    if (
      !dragged ||
      !target ||
      isDescendantOf(planner.state, draggingId, hit.id)
    ) {
      dropTargetId = null
      return
    }
    dropPosition = dropPositionFor(hit.element, clientY)
    dropTargetId = hit.id
  }

  function removeNodeDragWindowListeners() {
    removeNodeDragListeners?.()
    removeNodeDragListeners = null
  }

  function resetNodeDrag() {
    removeNodeDragWindowListeners()
    pendingNodeDrag = null
    draggingId = null
    dropTargetId = null
  }

  function beginNodeDrag(taskId: string, event: PointerEvent) {
    if (event.button !== 0) return
    event.preventDefault()
    resetNodeDrag()
    pendingNodeDrag = {
      taskId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    }
    ghostX = event.clientX
    ghostY = event.clientY

    const handleMove = (moveEvent: PointerEvent) => {
      if (!pendingNodeDrag || moveEvent.pointerId !== pendingNodeDrag.pointerId) return
      const deltaX = moveEvent.clientX - pendingNodeDrag.startX
      const deltaY = moveEvent.clientY - pendingNodeDrag.startY

      if (!pendingNodeDrag.active) {
        if (Math.hypot(deltaX, deltaY) < 4) return
        pendingNodeDrag.active = true
        draggingId = pendingNodeDrag.taskId
      }

      moveEvent.preventDefault()
      ghostX = moveEvent.clientX
      ghostY = moveEvent.clientY
      autoPanTree(moveEvent.clientX, moveEvent.clientY)
      updateNodeDropTarget(moveEvent.clientX, moveEvent.clientY)
    }

    const handleUp = (upEvent: PointerEvent) => {
      if (!pendingNodeDrag || upEvent.pointerId !== pendingNodeDrag.pointerId) return
      if (pendingNodeDrag.active) {
        const taskIdToMove = pendingNodeDrag.taskId
        const hit = nodeAtPoint(upEvent.clientX, upEvent.clientY)
        if (hit && hit.id !== taskIdToMove) {
          const dragged = planner.state.tasks[taskIdToMove]
          const target = planner.state.tasks[hit.id]
          if (
            dragged &&
            target &&
            !isDescendantOf(planner.state, taskIdToMove, hit.id)
          ) {
            planner.moveTaskRelative(
              taskIdToMove,
              hit.id,
              dropPositionFor(hit.element, upEvent.clientY),
            )
          }
        }
      }
      resetNodeDrag()
    }

    const handleCancel = (cancelEvent: PointerEvent) => {
      if (!pendingNodeDrag || cancelEvent.pointerId !== pendingNodeDrag.pointerId) return
      resetNodeDrag()
    }
    const handleBlur = () => resetNodeDrag()

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('blur', handleBlur)
    removeNodeDragListeners = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('blur', handleBlur)
    }
  }

  $effect(() => {
    if (autoFitted || layout.nodes.length === 0) return
    autoFitted = true
    requestAnimationFrame(() => fitToView())
  })

  onMount(() => {
    requestAnimationFrame(() => fitToView())
  })

  onDestroy(() => {
    removeNodeDragWindowListeners()
  })
</script>

<div class="tree-view">
  <div
    class="tree-viewport"
    class:panning
    bind:this={viewport}
    onwheel={handleWheel}
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerCancel}
    role="tree"
    aria-label="Task hierarchy"
    tabindex="-1"
  >
    <div
      class="tree-world"
      style="width: {layout.width}px; height: {layout.height}px; transform: translate({translateX}px, {translateY}px) scale({scale});"
    >
      <svg
        class="edge-layer"
        width={layout.width}
        height={layout.height}
        viewBox="0 0 {layout.width} {layout.height}"
        aria-hidden="true"
      >
        {#each layout.edges as edge (edge.from + '->' + edge.to)}
          <path
            class="edge"
            class:active={selectedPath.has(edge.from) && selectedPath.has(edge.to)}
            d={edge.path}
          />
        {/each}
      </svg>

      {#each layout.nodes as node (node.id)}
        <div
          class="tree-node"
          data-task-id={node.id}
          class:dragging={draggingId === node.id}
          class:drop-before={dropTargetId === node.id && dropPosition === 'before'}
          class:drop-after={dropTargetId === node.id && dropPosition === 'after'}
          class:drop-inside={dropTargetId === node.id && dropPosition === 'inside'}
          style="left: {node.x}px; top: {node.y}px; width: {node.width}px; height: {node.height}px;"
        >
          <TaskNode
            task={planner.state.tasks[node.id]}
            aggregate={aggregates.get(node.id)!}
            selected={planner.selectedTaskId === node.id}
            inPath={selectedPath.has(node.id)}
            onSelect={() => planner.selectTask(node.id)}
            onAddChild={() => planner.requestNewTask(node.id)}
            onToggleCollapse={() => planner.toggleTaskCollapse(node.id)}
            onDragHandlePointerDown={(event) => beginNodeDrag(node.id, event)}
            onMoveUp={() => planner.moveSiblingByOffset(node.id, -1)}
            onMoveDown={() => planner.moveSiblingByOffset(node.id, 1)}
            onStatusChange={(status) => planner.setStatus(node.id, status)}
          />
        </div>
      {/each}
    </div>

    {#if layout.nodes.length === 0}
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">◇</div>
        <h2>Your project is empty</h2>
        <p>Create a top-level task, then grow it into a tree of nested subtasks.</p>
        <button class="btn btn-primary" onclick={() => planner.requestNewTask(null)}>
          + New top-level task
        </button>
      </div>
    {/if}
  </div>

  <div class="tree-toolbar" aria-label="Tree view controls">
    <button class="btn btn-ghost" onclick={fitToView} title="Fit all tasks in view">Fit</button>
    <div class="toolbar-group">
      <button class="icon-btn" onclick={() => zoomBy(1 / 1.18)} title="Zoom out" aria-label="Zoom out">
        −
      </button>
      <span class="zoom-label">{Math.round(scale * 100)}%</span>
      <button class="icon-btn" onclick={() => zoomBy(1.18)} title="Zoom in" aria-label="Zoom in">
        +
      </button>
    </div>
    <div class="toolbar-divider"></div>
    <button class="btn btn-ghost" onclick={() => planner.expandAll()}>Expand all</button>
    <button class="btn btn-ghost" onclick={() => planner.collapseAll()}>Collapse all</button>
  </div>

  <div class="tree-hint desktop-hint">
    Drag handles to reorder or nest · Scroll to zoom · Alt+↑/↓ reorders siblings
  </div>
  <div class="tree-hint touch-hint">
    Drag handles to reorder or nest · Pinch to zoom
  </div>
</div>

{#if draggingTask}
  <DragGhost x={ghostX} y={ghostY} title={draggingTask.title} meta={ghostMeta} />
{/if}

<style>
  .tree-view {
    position: relative;
    height: 100%;
    overflow: hidden;
    background:
      radial-gradient(circle at 1px 1px, #cfd8e3 1px, transparent 0) 0 0 / 24px 24px,
      #f7f9fc;
  }

  .tree-viewport {
    position: absolute;
    inset: 0;
    overflow: hidden;
    cursor: grab;
    touch-action: none;
  }

  .tree-viewport.panning {
    cursor: grabbing;
  }

  .tree-world {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    will-change: transform;
  }

  .edge-layer {
    position: absolute;
    inset: 0;
    overflow: visible;
    pointer-events: none;
  }

  .edge {
    fill: none;
    stroke: #c3cedb;
    stroke-width: 1.6;
    transition: stroke 140ms ease;
  }

  .edge.active {
    stroke: var(--accent);
    stroke-width: 2.2;
  }

  .tree-node {
    position: absolute;
  }

  .tree-node.dragging {
    opacity: 0.45;
  }

  .tree-node.drop-before::before,
  .tree-node.drop-after::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 2px;
    background: var(--accent);
    z-index: 2;
    pointer-events: none;
  }

  .tree-node.drop-before::before {
    top: -6px;
  }

  .tree-node.drop-after::after {
    bottom: -6px;
  }

  .tree-node.drop-inside {
    border-radius: 12px;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.55);
    background: rgba(79, 70, 229, 0.08);
  }

  .tree-toolbar {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid var(--border);
    border-radius: 11px;
    box-shadow: var(--shadow);
    z-index: 5;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .zoom-label {
    min-width: 42px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .toolbar-divider {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 2px;
  }

  .tree-hint {
    position: absolute;
    left: 14px;
    bottom: 12px;
    font-size: 11px;
    color: var(--text-faint);
    background: rgba(255, 255, 255, 0.8);
    border-radius: 6px;
    padding: 4px 8px;
    pointer-events: none;
  }

  .touch-hint {
    display: none;
  }

  .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    pointer-events: none;
  }

  .empty-state h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
  }

  .empty-state p {
    margin: 0 0 10px;
    max-width: 340px;
    color: var(--text-muted);
  }

  .empty-state .btn {
    pointer-events: auto;
  }

  .empty-icon {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    font-size: 30px;
    color: var(--accent);
    background: var(--accent-soft);
    border-radius: 14px;
  }

  @media (any-pointer: coarse) {
    .desktop-hint {
      display: none;
    }

    .touch-hint {
      display: block;
    }
  }

  @media (max-width: 760px) {
    .desktop-hint {
      display: none;
    }

    .tree-toolbar {
      max-width: calc(100% - 24px);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tree-toolbar::-webkit-scrollbar {
      display: none;
    }
  }
</style>
