import {
  isCancelledStatus,
  isDoneStatus,
  isNotStartedStatus,
  isStartedStatus,
} from './statuses'
import type { Aggregate, DropPosition, PlannerState, StatusId, Task } from './types'

export interface RemovedSubtree {
  rootId: string
  parentId: string | null
  index: number
  tasks: Task[]
}

export function createEmptyState(view: PlannerState['lastView'] = 'board'): PlannerState {
  return {
    version: 1,
    rootIds: [],
    tasks: {},
    lastView: view,
  }
}

export function createTaskEntity(
  id: string,
  parentId: string | null,
  title: string,
  description = '',
  status: StatusId = 'backlog',
  now = Date.now(),
): Task {
  return {
    id,
    parentId,
    title: title.trim() || 'Untitled task',
    description,
    status,
    childIds: [],
    createdAt: now,
    updatedAt: now,
    collapsed: false,
  }
}

export function getTask(state: PlannerState, id: string | null | undefined): Task | undefined {
  if (!id) return undefined
  return state.tasks[id]
}

export function isLeaf(state: PlannerState, id: string): boolean {
  const task = state.tasks[id]
  return !!task && task.childIds.length === 0
}

export function getSiblingIds(state: PlannerState, id: string): string[] {
  const task = state.tasks[id]
  if (!task) return []
  if (task.parentId) return state.tasks[task.parentId]?.childIds ?? []
  return state.rootIds
}

export function getAncestorIds(state: PlannerState, id: string): string[] {
  const path: string[] = []
  const seen = new Set<string>()
  let current: Task | undefined = state.tasks[id]
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current.id)
    current = current.parentId ? state.tasks[current.parentId] : undefined
  }
  return path
}

export function getBreadcrumb(state: PlannerState, id: string): string[] {
  return getAncestorIds(state, id)
    .slice(0, -1)
    .map((ancestorId) => state.tasks[ancestorId]?.title ?? '')
    .filter(Boolean)
}

export function collectLeafTasks(state: PlannerState, id: string): Task[] {
  const leaves: Task[] = []
  const stack = [id]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const currentId = stack.pop()!
    if (seen.has(currentId)) continue
    seen.add(currentId)
    const task = state.tasks[currentId]
    if (!task) continue
    if (task.childIds.length === 0) {
      leaves.push(task)
    } else {
      for (let i = task.childIds.length - 1; i >= 0; i--) {
        stack.push(task.childIds[i])
      }
    }
  }
  return leaves
}

export function collectSubtreeIds(state: PlannerState, id: string): string[] {
  const ids: string[] = []
  const stack = [id]
  const seen = new Set<string>()
  while (stack.length > 0) {
    const currentId = stack.pop()!
    if (seen.has(currentId)) continue
    const task = state.tasks[currentId]
    if (!task) continue
    seen.add(currentId)
    ids.push(currentId)
    for (let i = task.childIds.length - 1; i >= 0; i--) {
      stack.push(task.childIds[i])
    }
  }
  return ids
}

function aggregateFromLeaves(leaves: Task[]): Aggregate {
  let total = 0
  let done = 0
  let cancelled = 0
  let started = 0
  let blocked = false

  for (const leaf of leaves) {
    if (isCancelledStatus(leaf.status)) {
      cancelled++
      continue
    }
    total++
    if (isDoneStatus(leaf.status)) {
      done++
      started++
    } else if (isStartedStatus(leaf.status)) {
      started++
      if (leaf.status === 'blocked') blocked = true
    }
  }

  let phase: Aggregate['phase']
  if (total === 0) {
    phase = 'cancelled'
  } else if (done === total) {
    phase = 'done'
  } else if (started === 0) {
    phase = 'not-started'
  } else {
    phase = 'in-progress'
  }

  return {
    phase,
    blocked,
    done,
    total,
    cancelled,
    started,
    percent: total === 0 ? null : done / total,
  }
}

export function aggregateTask(state: PlannerState, id: string): Aggregate {
  const task = state.tasks[id]
  if (!task) {
    return {
      phase: 'cancelled',
      blocked: false,
      done: 0,
      total: 0,
      cancelled: 0,
      started: 0,
      percent: null,
    }
  }
  return aggregateFromLeaves(collectLeafTasks(state, id))
}

export function computeAggregates(state: PlannerState): Map<string, Aggregate> {
  const results = new Map<string, Aggregate>()
  const visiting = new Set<string>()

  const visit = (id: string): Aggregate => {
    const existing = results.get(id)
    if (existing) return existing
    const task = state.tasks[id]
    if (!task) return aggregateFromLeaves([])
    if (visiting.has(id) || task.childIds.length === 0) {
      const aggregate = aggregateFromLeaves(task.childIds.length === 0 ? [task] : [])
      results.set(id, aggregate)
      return aggregate
    }

    visiting.add(id)
    let total = 0
    let done = 0
    let cancelled = 0
    let started = 0
    let blocked = false
    for (const childId of task.childIds) {
      const child = visit(childId)
      total += child.total
      done += child.done
      cancelled += child.cancelled
      started += child.started
      blocked = blocked || child.blocked
    }
    visiting.delete(id)

    let phase: Aggregate['phase']
    if (total === 0) {
      phase = 'cancelled'
    } else if (done === total) {
      phase = 'done'
    } else if (started === 0) {
      phase = 'not-started'
    } else {
      phase = 'in-progress'
    }

    const aggregate: Aggregate = {
      phase,
      blocked,
      done,
      total,
      cancelled,
      started,
      percent: total === 0 ? null : done / total,
    }
    results.set(id, aggregate)
    return aggregate
  }

  for (const id of Object.keys(state.tasks)) {
    visit(id)
  }
  return results
}

export function getLeafTasksInOrder(state: PlannerState): Task[] {
  const leaves: Task[] = []
  const gather = (id: string) => {
    const task = state.tasks[id]
    if (!task) return
    if (task.childIds.length === 0) {
      leaves.push(task)
    } else {
      for (const childId of task.childIds) gather(childId)
    }
  }
  for (const rootId of state.rootIds) gather(rootId)
  return leaves
}

export function groupLeavesByStatus(state: PlannerState): Record<StatusId, Task[]> {
  const grouped: Record<StatusId, Task[]> = {
    backlog: [],
    'next-up': [],
    'in-progress': [],
    blocked: [],
    done: [],
    cancelled: [],
  }
  for (const leaf of getLeafTasksInOrder(state)) {
    grouped[leaf.status].push(leaf)
  }
  return grouped
}

export function insertTask(state: PlannerState, task: Task, parentId: string | null, index?: number): void {
  const validParentId = parentId && state.tasks[parentId] ? parentId : null
  state.tasks[task.id] = task
  task.parentId = validParentId
  const siblings = validParentId ? state.tasks[validParentId].childIds : state.rootIds
  const targetIndex =
    index === undefined ? siblings.length : Math.max(0, Math.min(index, siblings.length))
  siblings.splice(targetIndex, 0, task.id)
  if (validParentId) {
    const parent = state.tasks[validParentId]
    parent.collapsed = false
    parent.updatedAt = Date.now()
  }
}

export function removeSubtree(state: PlannerState, id: string): RemovedSubtree | null {
  const task = state.tasks[id]
  if (!task) return null
  const siblings = getSiblingIds(state, id)
  const index = siblings.indexOf(id)
  if (index >= 0) siblings.splice(index, 1)

  const ids = collectSubtreeIds(state, id)
  const tasks = ids
    .map((taskId) => state.tasks[taskId])
    .filter((entry): entry is Task => !!entry)
    .map((entry) => ({
      ...entry,
      childIds: [...entry.childIds],
    }))

  for (const taskId of ids) {
    delete state.tasks[taskId]
  }

  return {
    rootId: id,
    parentId: task.parentId,
    index: Math.max(0, index),
    tasks,
  }
}

export function restoreSubtree(state: PlannerState, removed: RemovedSubtree): void {
  for (const task of removed.tasks) {
    state.tasks[task.id] = {
      ...task,
      childIds: [...task.childIds],
    }
  }
  const root = state.tasks[removed.rootId]
  if (!root) return
  const parentId =
    removed.parentId && state.tasks[removed.parentId] ? removed.parentId : null
  root.parentId = parentId
  const siblings = parentId ? state.tasks[parentId].childIds : state.rootIds
  const index = Math.max(0, Math.min(removed.index, siblings.length))
  siblings.splice(index, 0, removed.rootId)
}

export function moveSiblingByOffset(state: PlannerState, id: string, offset: number): boolean {
  const siblings = getSiblingIds(state, id)
  const from = siblings.indexOf(id)
  if (from < 0) return false
  const to = from + offset
  if (to < 0 || to >= siblings.length) return false
  siblings.splice(from, 1)
  siblings.splice(to, 0, id)
  return true
}

export function moveSiblingRelative(
  state: PlannerState,
  draggedId: string,
  targetId: string,
  position: 'before' | 'after',
): boolean {
  if (draggedId === targetId) return false
  const dragged = state.tasks[draggedId]
  const target = state.tasks[targetId]
  if (!dragged || !target || dragged.parentId !== target.parentId) return false

  const siblings = getSiblingIds(state, draggedId)
  const from = siblings.indexOf(draggedId)
  if (from < 0) return false

  siblings.splice(from, 1)
  const targetIndex = siblings.indexOf(targetId)
  if (targetIndex < 0) {
    siblings.splice(from, 0, draggedId)
    return false
  }
  const insertAt = position === 'after' ? targetIndex + 1 : targetIndex
  siblings.splice(insertAt, 0, draggedId)
  return true
}

export function setTaskStatus(state: PlannerState, id: string, status: StatusId): boolean {
  const task = state.tasks[id]
  if (!task || task.childIds.length > 0) return false
  if (task.status === status) return false
  task.status = status
  task.updatedAt = Date.now()
  return true
}


export function isDescendantOf(
  state: PlannerState,
  ancestorId: string,
  taskId: string,
): boolean {
  if (ancestorId === taskId) return false
  return collectSubtreeIds(state, ancestorId).includes(taskId)
}

export function moveTaskToParent(
  state: PlannerState,
  draggedId: string,
  newParentId: string | null,
  index: number,
): boolean {
  const dragged = state.tasks[draggedId]
  if (!dragged) return false
  const validParentId =
    newParentId && state.tasks[newParentId] ? newParentId : null
  if (validParentId === draggedId) return false
  if (validParentId && isDescendantOf(state, draggedId, validParentId)) return false

  const sourceList = getSiblingIds(state, draggedId)
  const targetList = validParentId
    ? state.tasks[validParentId].childIds
    : state.rootIds
  const sourceIndex = sourceList.indexOf(draggedId)
  if (sourceIndex < 0) return false

  const previousParentId = dragged.parentId
  let insertIndex = Math.max(0, Math.min(index, targetList.length))
  if (sourceList === targetList && sourceIndex < insertIndex) insertIndex -= 1

  sourceList.splice(sourceIndex, 1)
  targetList.splice(insertIndex, 0, draggedId)
  dragged.parentId = validParentId
  dragged.updatedAt = Date.now()

  if (previousParentId) {
    const previousParent = state.tasks[previousParentId]
    if (previousParent) previousParent.updatedAt = Date.now()
  }
  if (validParentId) {
    const parent = state.tasks[validParentId]
    parent.collapsed = false
    parent.updatedAt = Date.now()
  }
  return true
}

export function moveTaskRelative(
  state: PlannerState,
  draggedId: string,
  targetId: string,
  position: DropPosition,
): boolean {
  if (draggedId === targetId) return false
  const dragged = state.tasks[draggedId]
  const target = state.tasks[targetId]
  if (!dragged || !target) return false
  if (isDescendantOf(state, draggedId, targetId)) return false

  if (position === 'inside') {
    return moveTaskToParent(state, draggedId, targetId, target.childIds.length)
  }

  const newParentId = target.parentId
  const targetList = newParentId
    ? state.tasks[newParentId]?.childIds ?? []
    : state.rootIds
  const targetIndex = targetList.indexOf(targetId)
  if (targetIndex < 0) return false
  return moveTaskToParent(
    state,
    draggedId,
    newParentId,
    position === 'before' ? targetIndex : targetIndex + 1,
  )
}

export function toggleCollapse(state: PlannerState, id: string): void {
  const task = state.tasks[id]
  if (!task || task.childIds.length === 0) return
  task.collapsed = !task.collapsed
}

export function setAllCollapsed(state: PlannerState, collapsed: boolean): void {
  for (const task of Object.values(state.tasks)) {
    if (task.childIds.length > 0) task.collapsed = collapsed
  }
}

export function countDescendants(state: PlannerState, id: string): number {
  return Math.max(0, collectSubtreeIds(state, id).length - 1)
}
