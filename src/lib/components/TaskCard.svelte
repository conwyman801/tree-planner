<script lang="ts">
  import { getBreadcrumb } from '../tree'
  import { planner } from '../store.svelte'
  import type { Task } from '../types'

  interface Props {
    task: Task
    dragging: boolean
    onSelect: () => void
    onAddSubtask: () => void
    onPointerDown: (event: PointerEvent) => void
  }

  let { task, dragging, onSelect, onAddSubtask, onPointerDown }: Props = $props()

  let breadcrumb = $derived(getBreadcrumb(planner.state, task.id))
</script>

<div
  class="task-card"
  role="button"
  class:dragging
  onclick={onSelect}
  onpointerdown={(event) => onPointerDown(event)}
  onkeydown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }}
  tabindex="0"
  aria-label={task.title}
>
  {#if breadcrumb.length > 0}
    <div class="breadcrumb" title={breadcrumb.join(' › ')}>
      {breadcrumb.join(' › ')}
    </div>
  {/if}

  <div class="card-main">
    <div class="card-title">{task.title}</div>
    <span class="card-drag" title="Drag to move" aria-hidden="true">
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
        <circle cx="2.5" cy="3" r="1.15" />
        <circle cx="7.5" cy="3" r="1.15" />
        <circle cx="2.5" cy="7" r="1.15" />
        <circle cx="7.5" cy="7" r="1.15" />
        <circle cx="2.5" cy="11" r="1.15" />
        <circle cx="7.5" cy="11" r="1.15" />
      </svg>
    </span>
    <button
      class="icon-btn card-add"
      title="Add subtask"
      aria-label={`Add subtask under ${task.title}`}
      onclick={(event) => {
        event.stopPropagation()
        onAddSubtask()
      }}
    >
      +
    </button>
  </div>

  {#if task.description}
    <p class="card-description">{task.description}</p>
  {/if}
</div>

<style>
  .task-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 11px;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease,
      transform 120ms ease;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .task-card:hover {
    border-color: var(--border-strong);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    transform: translateY(-1px);
  }

  .task-card:active {
    cursor: grabbing;
  }

  .task-card.dragging {
    opacity: 0.4;
    transform: scale(0.98);
  }

  .breadcrumb {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-faint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 5px;
  }

  .card-main {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }

  .card-title {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.35;
    word-break: break-word;
  }

  .card-add,
  .card-drag {
    width: 22px;
    height: 22px;
    margin-top: -2px;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .card-add {
    font-size: 15px;
    font-weight: 600;
  }

  .card-drag {
    display: inline-flex;
    -webkit-touch-callout: none;
    align-items: center;
    justify-content: center;
    color: var(--text-faint);
    cursor: grab;
    border-radius: 5px;
    touch-action: none;
  }

  .card-drag:hover {
    background: var(--surface-muted);
    color: var(--text-muted);
  }

  .card-drag:active {
    cursor: grabbing;
  }

  .task-card:hover .card-add,
  .task-card:hover .card-drag,
  .task-card:focus-within .card-add,
  .task-card:focus-within .card-drag {
    opacity: 1;
  }

  @media (any-pointer: coarse) {
    .card-add,
    .card-drag {
      opacity: 1;
      width: 30px;
      height: 30px;
      margin-top: -4px;
    }

    .card-add {
      font-size: 18px;
    }
  }

  .card-description {
    margin: 6px 0 0;
    font-size: 11.5px;
    color: var(--text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
