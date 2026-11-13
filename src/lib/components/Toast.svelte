<script lang="ts">
  import { planner } from '../store.svelte'

  let toast = $derived(planner.toast)

  function runAction() {
    const action = planner.toast?.action
    planner.dismissToast()
    action?.()
  }
</script>

{#if toast}
  <div class="toast" role="status">
    <span class="toast-message">{toast.message}</span>
    {#if toast.actionLabel && toast.action}
      <button class="toast-action" onclick={runAction}>{toast.actionLabel}</button>
    {/if}
    <button class="toast-close" onclick={() => planner.dismissToast()} aria-label="Dismiss">
      ×
    </button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 22px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 90;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: min(480px, calc(100vw - 32px));
    padding: 10px 12px 10px 15px;
    background: #111827;
    color: #f8fafc;
    border-radius: 10px;
    box-shadow: var(--shadow-lg);
    font-size: 12.5px;
    animation: toast-in 160ms ease;
  }

  .toast-message {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toast-action {
    border: 0;
    background: transparent;
    color: #a5b4fc;
    font-weight: 750;
    font-size: 12.5px;
    padding: 2px 4px;
    border-radius: 4px;
    flex: none;
  }

  .toast-action:hover {
    color: #c7d2fe;
    background: rgba(255, 255, 255, 0.08);
  }

  .toast-close {
    border: 0;
    background: transparent;
    color: #94a3b8;
    font-size: 17px;
    line-height: 1;
    padding: 0 2px;
    flex: none;
  }

  .toast-close:hover {
    color: #f8fafc;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
  }
</style>
