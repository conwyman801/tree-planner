<script lang="ts">
  import { planner } from '../store.svelte'
  import { groupLeavesByStatus } from '../tree'
  import { STATUSES } from '../statuses'
  import type { StatusId } from '../types'
  import TaskCard from './TaskCard.svelte'

  let columns = $derived(groupLeavesByStatus(planner.state))
  let draggingId = $state<string | null>(null)
  let dragOverStatus = $state<StatusId | null>(null)

  function startDrag(taskId: string, event: DragEvent) {
    draggingId = taskId
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', taskId)
      event.dataTransfer.effectAllowed = 'move'
    }
  }

  function endDrag() {
    draggingId = null
    dragOverStatus = null
  }

  function dragOverColumn(event: DragEvent, status: StatusId) {
    if (!draggingId) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    dragOverStatus = status
  }

  function dragLeaveColumn(event: DragEvent, status: StatusId) {
    const target = event.currentTarget as HTMLElement
    const related = event.relatedTarget as Node | null
    if (related && target.contains(related)) return
    if (dragOverStatus === status) dragOverStatus = null
  }

  function dropOnColumn(event: DragEvent, status: StatusId) {
    event.preventDefault()
    const taskId = event.dataTransfer?.getData('text/plain') || draggingId
    if (taskId) planner.setStatus(taskId, status)
    endDrag()
  }
</script>

<div class="board-view">
  <div class="board-scroll">
    {#each STATUSES as status (status.id)}
      <section
        class="board-column"
        class:drag-over={dragOverStatus === status.id}
        style="--column-color: {status.color}; --column-soft: {status.soft}; --column-text: {status.text}"
        aria-label={`${status.label} column`}
        ondragover={(event) => dragOverColumn(event, status.id)}
        ondragleave={(event) => dragLeaveColumn(event, status.id)}
        ondrop={(event) => dropOnColumn(event, status.id)}
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
              onSelect={() => planner.selectTask(task.id)}
              onAddSubtask={() => planner.requestNewTask(task.id)}
              onDragStart={(event) => startDrag(task.id, event)}
              onDragEnd={endDrag}
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
    Only leaf tasks appear on the board. Add a subtask from a card to grow a tree.
  </div>
</div>

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
</style>
