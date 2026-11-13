<script lang="ts">
  import type { Aggregate } from '../types'

  let { aggregate, size = 38 }: { aggregate: Aggregate; size?: number } = $props()

  const radius = 15.9155
  const circumference = 2 * Math.PI * radius

  let percent = $derived(aggregate.phase === 'done' ? 1 : (aggregate.percent ?? 0))
  let tone = $derived(
    aggregate.phase === 'cancelled'
      ? 'cancelled'
      : aggregate.blocked
        ? 'blocked'
        : aggregate.phase,
  )
  let dash = $derived(`${Math.max(0, Math.min(1, percent)) * circumference} ${circumference}`)
  let label = $derived(
    aggregate.phase === 'cancelled'
      ? '—'
      : aggregate.total === 0
        ? '0%'
        : `${Math.round(percent * 100)}%`,
  )
</script>

<svg
  class="completion-ring {tone}"
  width={size}
  height={size}
  viewBox="0 0 36 36"
  role="img"
  aria-label={`${label} complete`}
>
  <circle class="track" cx="18" cy="18" r={radius} />
  <circle
    class="progress"
    cx="18"
    cy="18"
    r={radius}
    stroke-dasharray={dash}
    transform="rotate(-90 18 18)"
  />
  <text x="18" y="18" class="percent" text-anchor="middle" dominant-baseline="central">
    {label}
  </text>
</svg>

<style>
  .completion-ring {
    flex: none;
    display: block;
  }

  .completion-ring .track {
    fill: none;
    stroke: #eef2f7;
    stroke-width: 3.2;
  }

  .completion-ring .progress {
    fill: none;
    stroke: currentColor;
    stroke-width: 3.2;
    stroke-linecap: round;
    transition: stroke-dasharray 240ms ease;
  }

  .completion-ring .percent {
    fill: currentColor;
    font-size: 9px;
    font-weight: 800;
    font-family: var(--sans);
  }

  .completion-ring.not-started {
    color: #3b82f6;
  }

  .completion-ring.in-progress {
    color: #f59e0b;
  }

  .completion-ring.blocked {
    color: #ef4444;
  }

  .completion-ring.done {
    color: #10b981;
  }

  .completion-ring.cancelled {
    color: #94a3b8;
  }
</style>
