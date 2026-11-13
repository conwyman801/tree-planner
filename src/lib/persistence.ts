import { normalizeStatus } from './statuses'
import { createEmptyState } from './tree'
import type { PlannerState, Task, ViewMode } from './types'

export const STORAGE_KEY = 'recursive-planner:v1'

interface LoadedState {
  state: PlannerState
  warning: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asTimestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asView(value: unknown): ViewMode {
  return value === 'tree' ? 'tree' : 'board'
}

export function sanitizeState(input: unknown): PlannerState {
  if (!isRecord(input)) return createEmptyState()

  const rawTasks = isRecord(input.tasks) ? input.tasks : {}
  const now = Date.now()
  const tasks: Record<string, Task> = {}

  for (const [id, value] of Object.entries(rawTasks)) {
    if (!id || !isRecord(value)) continue
    tasks[id] = {
      id,
      parentId: typeof value.parentId === 'string' ? value.parentId : null,
      title: asString(value.title, 'Untitled task').trim() || 'Untitled task',
      description: asString(value.description, ''),
      status: normalizeStatus(value.status),
      childIds: Array.isArray(value.childIds)
        ? value.childIds.filter((childId): childId is string => typeof childId === 'string')
        : [],
      createdAt: asTimestamp(value.createdAt, now),
      updatedAt: asTimestamp(value.updatedAt, now),
      collapsed: value.collapsed === true,
    }
  }

  const candidateRoots = Array.isArray(input.rootIds)
    ? input.rootIds.filter((id): id is string => typeof id === 'string' && !!tasks[id])
    : []

  for (const task of Object.values(tasks)) {
    task.childIds = [...new Set(task.childIds)].filter(
      (childId) => childId !== task.id && !!tasks[childId],
    )
  }

  const visited = new Set<string>()
  const finalRoots: string[] = []

  const walk = (id: string, parentId: string | null): void => {
    if (visited.has(id) || !tasks[id]) return
    visited.add(id)
    const task = tasks[id]
    task.parentId = parentId
    task.childIds = task.childIds.filter((childId) => {
      if (visited.has(childId)) return false
      walk(childId, id)
      return true
    })
  }

  for (const id of candidateRoots) {
    if (visited.has(id)) continue
    walk(id, null)
    finalRoots.push(id)
  }

  for (const id of Object.keys(tasks)) {
    if (visited.has(id)) continue
    walk(id, null)
    finalRoots.push(id)
  }

  return {
    version: 1,
    rootIds: [...new Set(finalRoots)],
    tasks,
    lastView: asView(input.lastView),
  }
}

export function parseState(raw: string | null): LoadedState {
  if (!raw) return { state: createEmptyState(), warning: null }
  try {
    const parsed: unknown = JSON.parse(raw)
    const state = sanitizeState(parsed)
    const warning =
      isRecord(parsed) && isRecord(parsed.tasks)
        ? null
        : 'Saved planner data could not be read. Starting with an empty planner.'
    return { state, warning }
  } catch {
    return {
      state: createEmptyState(),
      warning: 'Saved planner data was corrupted. Starting with an empty planner.',
    }
  }
}

export function loadFromStorage(): LoadedState {
  if (typeof localStorage === 'undefined') {
    return { state: createEmptyState(), warning: null }
  }
  try {
    return parseState(localStorage.getItem(STORAGE_KEY))
  } catch {
    return {
      state: createEmptyState(),
      warning: 'Local storage is unavailable. Changes will not be saved.',
    }
  }
}

export function saveToStorage(state: PlannerState): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function serializeState(state: PlannerState): string {
  return JSON.stringify(state, null, 2)
}
