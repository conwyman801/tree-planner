<script lang="ts">
  import { planner } from '../store.svelte'
  import { aggregateTask, computeAggregates, countDescendants, getAncestorIds } from '../tree'
  import { phaseLabel, STATUS_BY_ID, STATUSES } from '../statuses'
  import type { StatusId, Task } from '../types'

  let task = $derived(planner.selectedTask)
  let hasChildren = $derived(!!task && task.childIds.length > 0)
  let aggregate = $derived(task ? aggregateTask(planner.state, task.id) : null)
  let aggregates = $derived(computeAggregates(planner.state))
  let children = $derived(
    task
      ? task.childIds
          .map((childId) => planner.state.tasks[childId])
          .filter((child): child is Task => !!child)
      : [],
  )
  let ancestors = $derived(task ? getAncestorIds(planner.state, task.id).slice(0, -1) : [])
  let descendantCount = $derived(task ? countDescendants(planner.state, task.id) : 0)

  let loadedId: string | null = null
  let title = $state('')
  let description = $state('')
  let confirmingDelete = $state(false)

  $effect(() => {
    const id = planner.selectedTaskId
    if (id === loadedId) return
    loadedId = id
    const current = id ? planner.state.tasks[id] : undefined
    title = current?.title ?? ''
    description = current?.description ?? ''
    confirmingDelete = false
  })

  function close() {
    planner.selectTask(null)
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || planner.newTaskRequest) return
    const target = event.target as HTMLElement | null
    if (target?.closest('.dialog')) return
    close()
  }

  function commitTitle() {
    if (!task) return
    const nextTitle = title.trim()
    if (!nextTitle) {
      title = task.title
      return
    }
    if (nextTitle !== task.title) planner.updateTask(task.id, { title: nextTitle })
  }

  function commitDescription() {
    if (!task || description === task.description) return
    planner.updateTask(task.id, { description })
  }

  function changeStatus(event: Event) {
    if (!task || hasChildren) return
    planner.setStatus(task.id, (event.currentTarget as HTMLSelectElement).value as StatusId)
  }

  function confirmDelete() {
    if (!task) return
    planner.deleteTask(task.id)
    confirmingDelete = false
  }

  function formatPercent(value: number | null): string {
    return value === null ? '—' : `${Math.round(value * 100)}%`
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if task && aggregate}
  <aside class="inspector" aria-label="Task details">
    <div class="inspector-head">
      <span class="eyebrow">Task details</span>
      <button class="icon-btn" onclick={close} aria-label="Close task details">×</button>
    </div>

    {#if ancestors.length > 0}
      <nav class="breadcrumb-trail" aria-label="Parent tasks">
        {#each ancestors as ancestorId, index (ancestorId)}
          {#if index > 0}<span class="crumb-separator">›</span>{/if}
          <button
            class="crumb"
            onclick={() => planner.selectTask(ancestorId)}
            title={planner.state.tasks[ancestorId]?.title}
          >
            {planner.state.tasks[ancestorId]?.title}
          </button>
        {/each}
      </nav>
    {/if}

    <label class="field title-field">
      <span class="sr-only">Title</span>
      <textarea
        class="title-input"
        bind:value={title}
        rows="1"
        onblur={commitTitle}
        onkeydown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            ;(event.currentTarget as HTMLTextAreaElement).blur()
          }
          if (event.key === 'Escape') {
            title = task?.title ?? ''
            ;(event.currentTarget as HTMLTextAreaElement).blur()
          }
        }}
      ></textarea>
    </label>

    <div class="summary-row">
      {#if hasChildren}
        <span class="chip phase-{aggregate.phase}">{phaseLabel(aggregate.phase)}</span>
        {#if aggregate.blocked && aggregate.phase !== 'done'}
          <span class="chip blocked-chip">blocked</span>
        {/if}
        <span class="summary-text">
          {aggregate.done}/{aggregate.total} done · {formatPercent(aggregate.percent)}
        </span>
      {:else}
        <span class="leaf-dot" style="background: {STATUS_BY_ID[task.status].color}"></span>
        <span class="summary-text">{STATUS_BY_ID[task.status].label} · leaf task</span>
      {/if}
    </div>

    {#if hasChildren}
      <div class="progress-track" aria-hidden="true">
        <div
          class="progress-fill phase-{aggregate.phase}"
          style="width: {Math.round((aggregate.percent ?? 0) * 100)}%"
        ></div>
      </div>
      <p class="derived-note">
        Status is derived from leaf descendants. Cancelled tasks don't count toward progress.
      </p>
    {:else}
      <label class="field">
        <span>Status</span>
        <select class="select" value={task.status} onchange={changeStatus}>
          {#each STATUSES as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </label>
    {/if}

    <label class="field">
      <span>Description</span>
      <textarea
        class="textarea description-input"
        bind:value={description}
        placeholder="Add notes…"
        onblur={commitDescription}
      ></textarea>
    </label>

    <div class="section-head">
      <h3>Subtasks</h3>
      <span class="count">{children.length}</span>
      <button class="btn btn-ghost add-child" onclick={() => planner.requestNewTask(task?.id ?? null)}>
        + Add
      </button>
    </div>

    {#if children.length === 0}
      <div class="no-children">
        No subtasks yet. Add one to turn this into a parent task.
      </div>
    {:else}
      <ul class="child-list">
        {#each children as child (child.id)}
          <li>
            <button class="child-row" onclick={() => planner.selectTask(child.id)}>
              {#if child.childIds.length > 0}
                <span class="mini-chip phase-{aggregates.get(child.id)?.phase ?? 'not-started'}">
                  {phaseLabel(aggregates.get(child.id)?.phase ?? 'not-started')}
                </span>
              {:else}
                <span
                  class="leaf-dot"
                  style="background: {STATUS_BY_ID[child.status].color}"
                ></span>
                <span class="child-status">{STATUS_BY_ID[child.status].label}</span>
              {/if}
              <span class="child-title">{child.title}</span>
            </button>
          </li>
        {/each}
      </ul>
      <p class="reorder-hint">Reorder siblings by dragging them in the tree view.</p>
    {/if}

    <div class="danger-zone">
      {#if confirmingDelete}
        <div class="confirm-box">
          <p>
            Delete <strong>{task.title}</strong>{#if descendantCount > 0}
              and all {descendantCount} descendant tasks{/if}?
          </p>
          <div class="confirm-actions">
            <button class="btn" onclick={() => (confirmingDelete = false)}>Cancel</button>
            <button class="btn btn-danger" onclick={confirmDelete}>Delete</button>
          </div>
        </div>
      {:else}
        <button class="btn btn-danger" onclick={() => (confirmingDelete = true)}>
          Delete task
        </button>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .inspector {
    position: fixed;
    top: 58px;
    right: 0;
    bottom: 0;
    width: 382px;
    max-width: 100%;
    z-index: 40;
    background: var(--surface);
    border-left: 1px solid var(--border);
    box-shadow: -16px 0 40px rgba(15, 23, 42, 0.12);
    padding: 16px 18px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 13px;
    animation: slide-in 150ms ease;
  }

  .inspector-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .eyebrow {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .breadcrumb-trail {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    font-size: 11.5px;
    margin-top: -6px;
  }

  .crumb {
    border: 0;
    background: transparent;
    padding: 1px 3px;
    border-radius: 4px;
    color: var(--text-muted);
    font-weight: 600;
    max-width: 130px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .crumb:hover {
    background: var(--surface-muted);
    color: var(--text);
  }

  .crumb-separator {
    color: var(--text-faint);
  }

  .title-field {
    margin: 0;
  }

  .title-input {
    width: 100%;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    padding: 4px 6px;
    margin-left: -6px;
    font-size: 20px;
    font-weight: 750;
    line-height: 1.25;
    color: var(--text);
    resize: none;
    overflow: hidden;
    field-sizing: content;
  }

  .title-input:hover {
    border-color: var(--border);
  }

  .title-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
    background: var(--surface);
  }

  .summary-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .summary-text {
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .leaf-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex: none;
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

  .progress-track {
    height: 6px;
    border-radius: 999px;
    background: #eef2f7;
    overflow: hidden;
    margin-top: -4px;
  }

  .progress-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 200ms ease;
  }

  .progress-fill.phase-not-started {
    background: #3b82f6;
  }

  .progress-fill.phase-in-progress {
    background: #f59e0b;
  }

  .progress-fill.phase-done {
    background: #10b981;
  }

  .progress-fill.phase-cancelled {
    background: #94a3b8;
  }

  .derived-note {
    margin: -5px 0 0;
    font-size: 10.5px;
    color: var(--text-faint);
    line-height: 1.4;
  }

  .description-input {
    min-height: 108px;
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-top: 4px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .section-head h3 {
    margin: 0;
    font-size: 12.5px;
    font-weight: 750;
    color: var(--text);
  }

  .count {
    min-width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: var(--surface-muted);
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-muted);
  }

  .add-child {
    margin-left: auto;
    padding: 5px 8px;
    font-size: 11.5px;
  }

  .no-children {
    border: 1px dashed var(--border-strong);
    border-radius: 9px;
    padding: 14px;
    font-size: 11.5px;
    color: var(--text-faint);
    text-align: center;
  }

  .child-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .child-row {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    border: 0;
    background: transparent;
    border-radius: 7px;
    padding: 6px 7px;
    text-align: left;
  }

  .child-row:hover {
    background: var(--surface-muted);
  }

  .child-status {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-faint);
    width: 58px;
    flex: none;
  }

  .child-title {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    font-weight: 550;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-chip {
    font-size: 9.5px;
    font-weight: 700;
    border-radius: 999px;
    padding: 2px 6px;
    flex: none;
  }

  .reorder-hint {
    margin: 2px 0 0;
    font-size: 10.5px;
    color: var(--text-faint);
  }

  .danger-zone {
    margin-top: auto;
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .confirm-box {
    background: var(--danger-soft);
    border: 1px solid #fecaca;
    border-radius: 9px;
    padding: 11px;
  }

  .confirm-box p {
    margin: 0 0 9px;
    font-size: 12px;
    color: #991b1b;
    line-height: 1.4;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  @keyframes slide-in {
    from {
      transform: translateX(20px);
      opacity: 0;
    }
  }

  @media (max-width: 620px) {
    .inspector {
      width: 100%;
      top: 58px;
    }
  }
</style>
