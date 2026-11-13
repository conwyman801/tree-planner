<script lang="ts">
  import { onDestroy } from 'svelte'
  import { planner } from '../store.svelte'
  import { groupLeavesByStatus } from '../tree'
  import { STATUSES, STATUS_BY_ID } from '../statuses'
  import type { StatusId } from '../types'
  import DragGhost from './DragGhost.svelte'
  import TaskCard from './TaskCard.svelte'

  interface PendingDrag {
    taskId: string
    pointerId: number
    startX: number
    startY: number
    active: boolean
  }

  let columns = $derived(groupLeavesByStatus(planner.state))
  let draggingId = $state<string | null>(null)
  let dragOverStatus = $state<StatusId | null>(null)
  let ghostX = $state(0)
  let ghostY = $state(0)
  let draggingTask = $derived(draggingId ? planner.state.tasks[draggingId] : undefined)
  let ghostMeta = $derived(
    draggingTask ? `${STATUS_BY_ID[draggingTask.status].label} · leaf task` : '',
  )

  let boardScroll: HTMLDivElement
  let pendingDrag: PendingDrag | null = null
  let removeDragListeners: (() => void) | null = null
  let suppressClickUntil = 0
  let suppressClickTaskId: string | null = null

  function statusAtPoint(clientX: number, clientY: number): StatusId | null {
    const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    const column = element?.closest<HTMLElement>('[data-status]')
    const status = column?.dataset.status
    return STATUSES.some((entry) => entry.id === status) ? (status as StatusId) : null
  }

  function autoScrollBoard(clientX: number) {
    if (!boardScroll) return
    const rect = boardScroll.getBoundingClientRect()
    const edge = 56
    const step = 22
    if (clientX < rect.left + edge) {
      const strength = Math.min(1, (rect.left + edge - clientX) / edge)
      boardScroll.scrollLeft -= Math.ceil(step * strength)
    } else if (clientX > rect.right - edge) {
      const strength = Math.min(1, (clientX - (rect.right - edge)) / edge)
      boardScroll.scrollLeft += Math.ceil(step * strength)
    }
  }

  function updateDragTarget(clientX: number, clientY: number) {
    autoScrollBoard(clientX)
    dragOverStatus = statusAtPoint(clientX, clientY)
  }

  function removeListeners() {
    removeDragListeners?.()
    removeDragListeners = null
  }

  function resetDrag() {
    removeListeners()
    pendingDrag = null
    draggingId = null
    dragOverStatus = null
  }

  function beginCardDrag(taskId: string, event: PointerEvent) {
    if (event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (event.pointerType === 'touch' && !target?.closest('.card-drag')) return
    if (!planner.state.tasks[taskId]) return

    resetDrag()
    pendingDrag = {
      taskId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    }
    ghostX = event.clientX
    ghostY = event.clientY

    const handleMove = (moveEvent: PointerEvent) => {
      if (!pendingDrag || moveEvent.pointerId !== pendingDrag.pointerId) return
      const deltaX = moveEvent.clientX - pendingDrag.startX
      const deltaY = moveEvent.clientY - pendingDrag.startY

      if (!pendingDrag.active) {
        if (Math.hypot(deltaX, deltaY) < 6) return
        pendingDrag.active = true
        draggingId = pendingDrag.taskId
      }

      moveEvent.preventDefault()
      ghostX = moveEvent.clientX
      ghostY = moveEvent.clientY
      updateDragTarget(moveEvent.clientX, moveEvent.clientY)
    }

    const handleUp = (upEvent: PointerEvent) => {
      if (!pendingDrag || upEvent.pointerId !== pendingDrag.pointerId) return
      const active = pendingDrag.active
      const taskIdToMove = pendingDrag.taskId
      if (active) {
        const status = statusAtPoint(upEvent.clientX, upEvent.clientY)
        if (status) planner.setStatus(taskIdToMove, status)
        suppressClickTaskId = taskIdToMove
        suppressClickUntil = Date.now() + 500
      }
      resetDrag()
    }

    const handleCancel = (cancelEvent: PointerEvent) => {
      if (!pendingDrag || cancelEvent.pointerId !== pendingDrag.pointerId) return
      resetDrag()
    }
    const handleBlur = () => resetDrag()

    window.addEventListener('pointermove', handleMove, { passive: false })
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleCancel)
    window.addEventListener('blur', handleBlur)
    removeDragListeners = () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleCancel)
      window.removeEventListener('blur', handleBlur)
    }
  }

  function selectCard(taskId: string) {
    if (
      suppressClickTaskId === taskId &&
      Date.now() < suppressClickUntil
    ) {
      return
    }
    planner.selectTask(taskId)
  }

  onDestroy(() => {
    removeListeners()
  })
</script>

<div class="board-view">
  <div class="board-scroll" bind:this={boardScroll}>
    {#each STATUSES as status (status.id)}
      <section
        class="board-column"
        class:drag-over={dragOverStatus === status.id}
        data-status={status.id}
        style="--column-color: {status.color}; --column-soft: {status.soft}; --column-text: {status.text}"
        aria-label={`${status.label} column`}
      >
        <header class="column-header">
          <div class="column-title">
            <span class="column-dot"></span>
            <h2>{status.label}</h2>
            <span class="column-count">{columns[status.id].length}</span>
          </div>
          <button
            class="icon-btn"
            title="Add top-level task in {status.label}"
            aria-label="Add top-level task in {status.label}"
            onclick={() => planner.requestNewTask(null, status.id)}
          >
            +
          </button>
        </header>

        <div class="column-body">
          {#each columns[status.id] as task (task.id)}
            <TaskCard
              {task}
              dragging={draggingId === task.id}
              onSelect={() => selectCard(task.id)}
              onAddSubtask={() => planner.requestNewTask(task.id)}
              onPointerDown={(event) => beginCardDrag(task.id, event)}
            />
          {/each}

          {#if columns[status.id].length === 0}
            <div class="column-empty">Drop leaf tasks here</div>
          {/if}
        </div>

        {#if dragOverStatus === status.id}
          <div class="drop-overlay" aria-hidden="true"></div>
        {/if}
      </section>
    {/each}
  </div>

  <div class="board-note">
    Drag cards between columns. Only leaf tasks appear on the board; add a subtask from a
    card to grow a tree.
  </div>
</div>

{#if draggingTask}
  <DragGhost x={ghostX} y={ghostY} title={draggingTask.title} meta={ghostMeta} />
{/if}

<style>
  .board-view {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .board-scroll {
    flex: 1;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 20px 24px 16px;
    scrollbar-color: #cbd5e1 transparent;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
  }

  .board-column {
    position: relative;
    flex: 0 0 284px;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid var(--border);
    border-radius: 14px;
    transition:
      border-color 120ms ease,
      background 120ms ease;
    min-height: 120px;
    scroll-snap-align: start;
  }

  .board-column.drag-over {
    border-color: var(--column-color);
    background: var(--column-soft);
  }

  .column-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 10px 10px 13px;
    border-bottom: 1px solid var(--border);
    flex: none;
  }

  .column-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .column-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--column-color);
    flex: none;
  }

  .column-title h2 {
    margin: 0;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--column-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .column-count {
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    display: inline-grid;
    place-items: center;
    border-radius: 999px;
    background: var(--column-soft);
    color: var(--column-text);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .column-header .icon-btn {
    margin-left: auto;
    font-size: 16px;
  }

  .column-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    overflow-y: auto;
    min-height: 86px;
    scrollbar-color: #cbd5e1 transparent;
    overscroll-behavior-y: contain;
  }

  .column-empty {
    display: grid;
    place-items: center;
    border: 1px dashed var(--border-strong);
    border-radius: 9px;
    padding: 20px 10px;
    font-size: 11.5px;
    color: var(--text-faint);
    text-align: center;
  }

  .drop-overlay {
    position: absolute;
    inset: 0;
    border-radius: 14px;
    border: 2px dashed var(--column-color);
    pointer-events: none;
    background: color-mix(in srgb, var(--column-soft) 55%, transparent);
  }

  .board-note {
    flex: none;
    padding: 0 24px 12px;
    font-size: 11.5px;
    color: var(--text-faint);
  }

  @media (max-width: 760px) {
    .board-scroll {
      padding: 14px 14px 10px;
    }

    .board-column {
      flex-basis: 260px;
    }

    .board-note {
      display: none;
    }
  }

  @media (any-pointer: coarse) {
    .board-scroll {
      scroll-snap-type: none;
    }
  }
</style>
