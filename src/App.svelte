<script lang="ts">
  import { onMount } from 'svelte'
  import BoardView from './lib/components/BoardView.svelte'
  import Header from './lib/components/Header.svelte'
  import NewTaskDialog from './lib/components/NewTaskDialog.svelte'
  import TaskInspector from './lib/components/TaskInspector.svelte'
  import Toast from './lib/components/Toast.svelte'
  import TreeView from './lib/components/TreeView.svelte'
  import { planner } from './lib/store.svelte'

  onMount(() => {
    window.addEventListener('beforeunload', planner.flush)
    return () => window.removeEventListener('beforeunload', planner.flush)
  })
</script>

<div class="app">
  <Header />

  {#if planner.storageWarning}
    <div class="warning-banner" role="alert">
      <span>{planner.storageWarning}</span>
      <button
        class="icon-btn"
        aria-label="Dismiss warning"
        onclick={() => (planner.storageWarning = null)}
      >
        ×
      </button>
    </div>
  {/if}

  <main class="app-main">
    {#if planner.state.lastView === 'board'}
      <BoardView />
    {:else}
      <TreeView />
    {/if}
  </main>

  <TaskInspector />

  {#if planner.newTaskRequest}
    {#key planner.newTaskRequest}
      <NewTaskDialog />
    {/key}
  {/if}

  <Toast />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .app-main {
    flex: 1;
    min-height: 0;
    position: relative;
  }

  .warning-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 10px 7px 18px;
    background: #fffbeb;
    border-bottom: 1px solid #fde68a;
    color: #92400e;
    font-size: 12px;
    font-weight: 550;
    flex: none;
  }
</style>
