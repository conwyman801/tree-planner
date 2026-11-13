<script lang="ts">
  import { onMount } from 'svelte'
  import { planner } from '../store.svelte'

  let dataMenu: HTMLDetailsElement
  let fileInput: HTMLInputElement
  let taskCount = $derived(Object.keys(planner.state.tasks).length)

  let saveLabel = $derived(
    planner.saveStatus === 'saved'
      ? 'Saved locally'
      : planner.saveStatus === 'saving'
        ? 'Saving…'
        : 'Save failed',
  )

  function closeMenu() {
    if (dataMenu) dataMenu.open = false
  }

  async function handleImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (file) await planner.importFromFile(file)
    input.value = ''
    closeMenu()
  }

  function handleReset() {
    closeMenu()
    if (
      window.confirm(
        'Clear the entire planner? This deletes every task and cannot be undone.',
      )
    ) {
      planner.resetPlanner()
    }
  }

  function triggerImport() {
    fileInput?.click()
  }

  onMount(() => {
    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (!dataMenu?.open) return
      if (!dataMenu.contains(event.target as Node)) dataMenu.open = false
    }
    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown)
  })
</script>

<header class="app-header">
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <rect x="1.5" y="6.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" />
        <rect x="12.5" y="1.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" />
        <rect x="12.5" y="12.5" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" />
        <path d="M7.5 9.5h2.5V4.5h2.5M10 9.5v6h2.5" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </div>
    <div class="brand-text">
      <span class="brand-name">Recursive Planner</span>
      <span class="brand-meta">{taskCount} tasks · local only</span>
    </div>
  </div>

  <nav class="view-switch" aria-label="View">
    <button
      class:active={planner.state.lastView === 'board'}
      aria-pressed={planner.state.lastView === 'board'}
      onclick={() => planner.setView('board')}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="1.5" y="2" width="3.5" height="12" rx="1" />
        <rect x="6.25" y="2" width="3.5" height="9" rx="1" />
        <rect x="11" y="2" width="3.5" height="6" rx="1" />
      </svg>
      Board
    </button>
    <button
      class:active={planner.state.lastView === 'tree'}
      aria-pressed={planner.state.lastView === 'tree'}
      onclick={() => planner.setView('tree')}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="3" cy="8" r="1.8" />
        <circle cx="12.5" cy="3.5" r="1.8" />
        <circle cx="12.5" cy="12.5" r="1.8" />
        <path d="M4.8 8h2.2V3.5h3.7M7 8v4.5h3.7" />
      </svg>
      Tree
    </button>
  </nav>

  <div class="header-actions">
    <span class="save-state {planner.saveStatus}" title="Data is stored in this browser">
      <span class="save-dot"></span>
      {saveLabel}
    </span>

    <button class="btn btn-primary" onclick={() => planner.requestNewTask(null)}>
      <span class="plus" aria-hidden="true">+</span>
      New task
    </button>

    <details class="data-menu" bind:this={dataMenu}>
      <summary class="btn" aria-label="Planner data options">
        Data
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
          <path d="M2 3.5 5 6.5 8 3.5" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </summary>
      <div class="menu-panel">
        <button class="menu-item" onclick={() => { planner.exportToFile(); closeMenu() }}>
          Export JSON
        </button>
        <button class="menu-item" onclick={triggerImport}>Import JSON</button>
        <div class="menu-separator"></div>
        <button class="menu-item danger" onclick={handleReset}>Clear planner</button>
      </div>
    </details>

    <input
      class="sr-only"
      type="file"
      accept="application/json,.json"
      bind:this={fileInput}
      onchange={handleImport}
      tabindex="-1"
      aria-hidden="true"
    />
  </div>
</header>

<style>
  .app-header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 0 18px;
    height: 58px;
    flex: none;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: relative;
    z-index: 20;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .brand-mark {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    color: var(--accent);
    background: var(--accent-soft);
    border-radius: 9px;
    flex: none;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.2;
  }

  .brand-name {
    font-size: 14px;
    font-weight: 750;
    color: var(--text);
    white-space: nowrap;
  }

  .brand-meta {
    font-size: 10.5px;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .view-switch {
    display: flex;
    align-items: center;
    gap: 2px;
    background: var(--surface-muted);
    border: 1px solid var(--border);
    border-radius: 9px;
    padding: 2px;
    margin-left: auto;
  }

  .view-switch button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 0;
    background: transparent;
    color: var(--text-muted);
    border-radius: 7px;
    padding: 6px 11px;
    font-size: 12.5px;
    font-weight: 650;
  }

  .view-switch button:hover {
    color: var(--text);
  }

  .view-switch button.active {
    background: var(--surface);
    color: var(--accent);
    box-shadow: var(--shadow-sm);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .save-state {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-faint);
    white-space: nowrap;
  }

  .save-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
  }

  .save-state.saving .save-dot {
    background: #f59e0b;
  }

  .save-state.error {
    color: var(--danger);
  }

  .save-state.error .save-dot {
    background: var(--danger);
  }

  .plus {
    font-size: 16px;
    font-weight: 500;
    line-height: 0.8;
  }

  .data-menu {
    position: relative;
  }

  .data-menu summary {
    list-style: none;
  }

  .data-menu summary::-webkit-details-marker {
    display: none;
  }

  .menu-panel {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 170px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: var(--shadow);
    padding: 5px;
    z-index: 30;
  }

  .menu-item {
    display: block;
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    border-radius: 7px;
    padding: 8px 9px;
    font-size: 12.5px;
    font-weight: 550;
    color: var(--text);
  }

  .menu-item:hover {
    background: var(--surface-muted);
  }

  .menu-item.danger {
    color: var(--danger);
  }

  .menu-item.danger:hover {
    background: var(--danger-soft);
  }

  .menu-separator {
    height: 1px;
    background: var(--border);
    margin: 4px 2px;
  }

  @media (max-width: 860px) {
    .brand-meta,
    .save-state {
      display: none;
    }

    .app-header {
      gap: 10px;
    }
  }

  @media (max-width: 620px) {
    .brand-text {
      display: none;
    }

    .view-switch button {
      padding: 6px 9px;
    }
  }
</style>
