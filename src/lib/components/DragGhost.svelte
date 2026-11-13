<script lang="ts">
  let {
    x,
    y,
    title,
    meta = '',
  }: { x: number; y: number; title: string; meta?: string } = $props()
</script>

<div class="drag-ghost" style="left: {x}px; top: {y}px;" aria-hidden="true">
  <div class="ghost-title">{title}</div>
  {#if meta}<div class="ghost-meta">{meta}</div>{/if}
</div>

<style>
  .drag-ghost {
    position: fixed;
    z-index: 120;
    max-width: 260px;
    padding: 9px 12px;
    border: 1px solid #c7d2fe;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.97);
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.24);
    transform: translate(-50%, calc(-100% - 18px)) rotate(-1.5deg);
    pointer-events: none;
    opacity: 0.97;
  }

  .ghost-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ghost-meta {
    margin-top: 2px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
