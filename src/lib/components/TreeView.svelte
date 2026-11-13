<script lang="ts">
  import { onMount } from 'svelte'
  import { computeLayout } from '../layout'
  import { planner } from '../store.svelte'
  import { computeAggregates, getAncestorIds } from '../tree'
  import TaskNode from './TaskNode.svelte'

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
  let panStartX = 0
  let panStartY = 0
  let panStartTranslateX = 0
  let panStartTranslateY = 0
  let didPan = false

  let draggingId = $state<string | null>(null)
  let dropTargetId = $state<string | null>(null)
  let dropPosition = $state<'before' | 'after'>('before')

  function clampScale(value: number): number {
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, value))
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

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (
      target?.closest(
        '.tree-node, button, a, input, select, textarea, label, summary, [role="button"]',
      )
    ) {
      return
    }
    panning = true
    didPan = false
    panStartX = event.clientX
    panStartY = event.clientY
    panStartTranslateX = translateX
    panStartTranslateY = translateY
    viewport.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent) {
    if (!panning) return
    const deltaX = event.clientX - panStartX
    const deltaY = event.clientY - panStartY
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) didPan = true
    translateX = panStartTranslateX + deltaX
    translateY = panStartTranslateY + deltaY
  }

  function handlePointerUp(event: PointerEvent) {
    if (!panning) return
    panning = false
    viewport.releasePointerCapture(event.pointerId)
    if (!didPan) planner.selectTask(null)
  }

  function startDrag(taskId: string, event: DragEvent) {
    draggingId = taskId
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', taskId)
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  function dragOverNode(event: DragEvent, targetId: string) {
    if (!draggingId || draggingId === targetId) return
    const dragged = planner.state.tasks[draggingId]
    const target = planner.state.tasks[targetId]
    if (!dragged || !target || dragged.parentId !== target.parentId) {
      dropTargetId = null
      return
    }
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    dropPosition = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    dropTargetId = targetId
  }

  function dropOnNode(event: DragEvent, targetId: string) {
    event.preventDefault()
    if (draggingId && dropTargetId && draggingId !== targetId) {
      planner.moveSiblingRelative(draggingId, targetId, dropPosition)
    }
    endDrag()
  }

  function endDrag() {
    draggingId = null
    dropTargetId = null
  }

  $effect(() => {
    if (autoFitted || layout.nodes.length === 0) return
    autoFitted = true
    requestAnimationFrame(() => fitToView())
  })

  onMount(() => {
    requestAnimationFrame(() => fitToView())
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
          role="none"
          class:dragging={draggingId === node.id}
          class:drop-before={dropTargetId === node.id && dropPosition === 'before'}
          class:drop-after={dropTargetId === node.id && dropPosition === 'after'}
          style="left: {node.x}px; top: {node.y}px; width: {node.width}px; height: {node.height}px;"
          ondragover={(event) => dragOverNode(event, node.id)}
          ondragleave={(event) => {
            const related = event.relatedTarget as Node | null
            if (related && (event.currentTarget as HTMLElement).contains(related)) return
            if (dropTargetId === node.id) dropTargetId = null
          }}
          ondrop={(event) => dropOnNode(event, node.id)}
          ondragend={endDrag}
        >
          <TaskNode
            task={planner.state.tasks[node.id]}
            aggregate={aggregates.get(node.id)!}
            selected={planner.selectedTaskId === node.id}
            inPath={selectedPath.has(node.id)}
            onSelect={() => planner.selectTask(node.id)}
            onAddChild={() => planner.requestNewTask(node.id)}
            onToggleCollapse={() => planner.toggleTaskCollapse(node.id)}
            onDragStart={(event) => startDrag(node.id, event)}
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

  <div class="tree-hint">Drag the canvas to pan · Scroll to zoom · Alt+↑/↓ to reorder siblings</div>
</div>

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

  @media (max-width: 760px) {
    .tree-hint {
      display: none;
    }

    .tree-toolbar {
      max-width: calc(100% - 24px);
      overflow-x: auto;
    }
  }
</style>
