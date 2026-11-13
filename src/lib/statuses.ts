import type { AggregatePhase, StatusId } from './types'

export interface StatusMeta {
  id: StatusId
  label: string
  color: string
  soft: string
  text: string
}

export const STATUSES: StatusMeta[] = [
  { id: 'backlog', label: 'Backlog', color: '#64748b', soft: '#eef2f7', text: '#334155' },
  { id: 'next-up', label: 'Next Up', color: '#0284c7', soft: '#e0f2fe', text: '#075985' },
  { id: 'in-progress', label: 'In Progress', color: '#d97706', soft: '#fef3c7', text: '#92400e' },
  { id: 'blocked', label: 'Blocked', color: '#dc2626', soft: '#fee2e2', text: '#991b1b' },
  { id: 'done', label: 'Done', color: '#059669', soft: '#d1fae5', text: '#065f46' },
  { id: 'cancelled', label: 'Cancelled', color: '#94a3b8', soft: '#f1f5f9', text: '#475569' },
]

export const STATUS_BY_ID: Record<StatusId, StatusMeta> = Object.fromEntries(
  STATUSES.map((status) => [status.id, status]),
) as Record<StatusId, StatusMeta>

export const STATUS_IDS: StatusId[] = STATUSES.map((status) => status.id)

export function isDoneStatus(status: StatusId): boolean {
  return status === 'done'
}

export function isCancelledStatus(status: StatusId): boolean {
  return status === 'cancelled'
}

export function isNotStartedStatus(status: StatusId): boolean {
  return status === 'backlog' || status === 'next-up'
}

export function isStartedStatus(status: StatusId): boolean {
  return !isNotStartedStatus(status) && !isCancelledStatus(status)
}

export function phaseLabel(phase: AggregatePhase): string {
  switch (phase) {
    case 'not-started':
      return 'Not Started'
    case 'in-progress':
      return 'In Progress'
    case 'done':
      return 'Done'
    case 'cancelled':
      return 'Cancelled'
  }
}

export function normalizeStatus(value: unknown): StatusId {
  return typeof value === 'string' && STATUS_IDS.includes(value as StatusId)
    ? (value as StatusId)
    : 'backlog'
}
