<script lang="ts">
  import CompletionRing from './CompletionRing.svelte'
  import { phaseLabel, STATUS_BY_ID, STATUSES } from '../statuses'
  import type { Aggregate, StatusId, Task } from '../types'

  interface Props {
    task: Task
    aggregate: Aggregate
    selected: boolean
    inPath: boolean
    onSelect: () => void
    onAddChild: () => void
    onToggleCollapse: () => void
    onDragHandlePointerDown: (event: PointerEvent) => void
    onMoveUp: () => void
    onMoveDown: () => void
    onStatusChange: (status: StatusId) => void
  }

  let {
    task,
    aggregate,
    selected,
    inPath,
    onSelect,
    onAddChild,
    onToggleCollapse,
    onDragHandlePointerDown,
    onMoveUp,
    onMoveDown,
    onStatusChange,
  }: Props = $props()

  let hasChildren = $derived(task.childIds.length > 0)
  let status = $derived(STATUS_BY_ID[task.status])

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
      return
    }
    if (event.altKey && event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      onMoveUp()
      return
    }
    if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      onMoveDown()
    }
  }

</script>

<div
  class="task-node"
  class:selected
  class:in-path={inPath && !selected}
  class:parent={hasChildren}
  role="treeitem"
  tabindex="0"
  aria-selected={selected}
  aria-expanded={hasChildren ? !task.collapsed : undefined}
  onclick={onSelect}
  onkeydown={handleKeydown}
>
  <div class="node-top">
    <span
      class="drag-handle"
      title="Drag to reorder among siblings (Alt+↑/↓ also works)"
      aria-hidden="true"
      onpointerdown={(event) => {
        event.stopPropagation()
        onDragHandlePointerDown(event)
      }}
      onclick={(event) => event.stopPropagation()}
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="2.5" cy="3" r="1.2" />
        <circle cx="7.5" cy="3" r="1.2" />
        <circle cx="2.5" cy="8" r="1.2" />
        <circle cx="7.5" cy="8" r="1.2" />
        <circle cx="2.5" cy="13" r="1.2" />
        <circle cx="7.5" cy="13" r="1.2" />
      </svg>
    </span>

    {#if hasChildren}
      <CompletionRing {aggregate} size={36} />
    {:else}
      <span class="status-dot" style="color: {status.color}" title={status.label}></span>
    {/if}

    <div class="node-title" title={task.title}>{task.title}</div>

    <div class="node-actions">
      <button
        class="icon-btn"
        title="Add subtask"
        aria-label={`Add subtask under ${task.title}`}
        onclick={(event) => {
          event.stopPropagation()
          onAddChild()
        }}
      >
        +
      </button>
      {#if hasChildren}
        <button
          class="icon-btn collapse-toggle"
          class:collapsed={task.collapsed}
          title={task.collapsed ? 'Expand subtasks' : 'Collapse subtasks'}
          aria-label={task.collapsed ? 'Expand subtasks' : 'Collapse subtasks'}
          onclick={(event) => {
            event.stopPropagation()
            onToggleCollapse()
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor">
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <div class="node-meta">
    {#if hasChildren}
      <span class="chip phase-{aggregate.phase}">{phaseLabel(aggregate.phase)}</span>
      <span class="progress-text">{aggregate.done}/{aggregate.total} done</span>
      {#if aggregate.blocked && aggregate.phase !== 'done'}
        <span class="chip blocked-chip">blocked</span>
      {/if}
      <span class="child-count">
        {task.childIds.length}
        {task.childIds.length === 1 ? 'item' : 'items'}
      </span>
    {:else}
      <select
        class="status-select"
        style="--status-soft: {status.soft}; --status-text: {status.text}; --status-color: {status.color}"
        value={task.status}
        aria-label="Status for {task.title}"
        onclick={(event) => event.stopPropagation()}
        onchange={(event) => {
          const value = (event.currentTarget as HTMLSelectElement).value as StatusId
          if (value !== task.status) onStatusChange(value)
        }}
      >
        {#each STATUSES as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    {/if}
  </div>
</div>

<style>
  .task-node {
    height: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 11px 9px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease,
      transform 120ms ease;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .task-node:hover {
    border-color: var(--border-strong);
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
  }

  .task-node.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.16);
  }

  .task-node.in-path {
    border-color: #c7d2fe;
    background: #fbfcff;
  }

  .task-node.parent {
    border-left: 3px solid #e0e7ff;
  }

  .node-top {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .drag-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 24px;
    color: var(--text-faint);
    cursor: grab;
    border-radius: 4px;
    flex: none;
    touch-action: none;
    user-select: none;
    -webkit-touch-callout: none;
  }

  .drag-handle:hover {
    color: var(--text-muted);
    background: var(--surface-muted);
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .status-dot {
    width: 9px;
    height: 9px;
    margin: 0 2px;
    flex: none;
  }

  .node-title {
    flex: 1;
    min-width: 0;
    font-size: 13.5px;
    font-weight: 650;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .node-actions {
    display: flex;
    align-items: center;
    gap: 1px;
    flex: none;
  }

  .node-actions .icon-btn {
    width: 24px;
    height: 24px;
    font-size: 16px;
    font-weight: 600;
  }

  .collapse-toggle svg {
    transition: transform 140ms ease;
  }

  .collapse-toggle.collapsed svg {
    transform: rotate(-90deg);
  }

  .node-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: auto;
    min-width: 0;
    overflow: hidden;
  }

  .phase-not-started {
    background: #e0f2fe;
    color: #075985;
  }

  .phase-in-progress {
    background: #fef3c7;
    color: #92400e;
  }

  .phase-done {
    background: #d1fae5;
    color: #065f46;
  }

  .phase-cancelled {
    background: #f1f5f9;
    color: #64748b;
  }

  .blocked-chip {
    background: #fee2e2;
    color: #991b1b;
  }

  .progress-text,
  .child-count {
    font-size: 10.5px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .child-count {
    margin-left: auto;
    color: var(--text-faint);
  }

  .status-select {
    appearance: none;
    border: 1px solid transparent;
    border-radius: 999px;
    background: var(--status-soft);
    color: var(--status-text);
    font-size: 11px;
    font-weight: 700;
    padding: 3px 22px 3px 9px;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3.5 5 6.5 8 3.5' fill='none' stroke='%2364748b' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 7px center;
    max-width: 150px;
  }

  .status-select:hover {
    filter: brightness(0.97);
  }

  @media (any-pointer: coarse) {
    .drag-handle {
      width: 24px;
      height: 32px;
    }

    .node-actions .icon-btn {
      width: 32px;
      height: 32px;
    }
  }
</style>
