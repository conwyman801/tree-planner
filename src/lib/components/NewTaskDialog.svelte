<script lang="ts">
  import { onMount } from 'svelte'
  import { planner } from '../store.svelte'
  import { STATUSES } from '../statuses'
  import type { StatusId } from '../types'

  let request = $derived(planner.newTaskRequest)
  let titleInput: HTMLInputElement
  let title = $state('')
  let description = $state('')
  let status = $state<StatusId>(planner.newTaskRequest?.status ?? 'backlog')

  let parent = $derived(
    request?.parentId ? planner.state.tasks[request.parentId] : undefined,
  )

  onMount(() => {
    titleInput?.focus()
  })

  function submit() {
    if (!request) return
    planner.addTask(request.parentId, title, description, status)
    planner.cancelNewTask()
  }

  function cancel() {
    planner.cancelNewTask()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class="dialog-backdrop"
  role="presentation"
  onclick={(event) => {
    if (event.target === event.currentTarget) cancel()
  }}
>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-task-title">
    <div class="dialog-head">
      <div>
        <h2 id="new-task-title">{parent ? 'Add subtask' : 'New top-level task'}</h2>
        {#if parent}
          <p class="parent-context">
            Under <strong>{parent.title}</strong>
          </p>
        {:else}
          <p class="parent-context">This task will start as a leaf on the board.</p>
        {/if}
      </div>
      <button class="icon-btn" onclick={cancel} aria-label="Close dialog">×</button>
    </div>

    <div class="dialog-body">
      <label class="field">
        <span>Title</span>
        <input
          class="input"
          bind:this={titleInput}
          bind:value={title}
          placeholder="What needs to be done?"
          onkeydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
      </label>

      <label class="field">
        <span>Description <em>(optional)</em></span>
        <textarea
          class="textarea"
          bind:value={description}
          placeholder="Add context, acceptance criteria, or notes…"
          onkeydown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              submit()
            }
          }}
        ></textarea>
      </label>

      <label class="field">
        <span>Status</span>
        <select class="select" bind:value={status}>
          {#each STATUSES as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="dialog-actions">
      <button class="btn" onclick={cancel}>Cancel</button>
      <button class="btn btn-primary" onclick={submit}>
        {parent ? 'Add subtask' : 'Create task'}
      </button>
    </div>
  </div>
</div>

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    background: rgba(15, 23, 42, 0.38);
    backdrop-filter: blur(2px);
    padding: 20px;
    animation: fade-in 120ms ease;
  }

  .dialog {
    width: min(480px, 100%);
    max-height: calc(100dvh - 40px);
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    animation: pop-in 150ms ease;
  }

  .dialog-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 18px 18px 14px;
    border-bottom: 1px solid var(--border);
  }

  .dialog-head h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 750;
    color: var(--text);
  }

  .parent-context {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .parent-context strong {
    color: var(--text);
    font-weight: 650;
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
  }

  .field em {
    font-style: normal;
    font-weight: 400;
    color: var(--text-faint);
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 14px 18px 18px;
    border-top: 1px solid var(--border);
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
  }

  @media (max-width: 620px) {
    .dialog-backdrop {
      padding: 12px;
      align-items: end;
    }

    .dialog {
      width: 100%;
      max-height: calc(100dvh - 24px);
      border-radius: 16px 16px 12px 12px;
    }
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
  }
</style>
