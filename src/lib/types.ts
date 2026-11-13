export type StatusId =
  | 'backlog'
  | 'next-up'
  | 'in-progress'
  | 'blocked'
  | 'done'
  | 'cancelled'

export type ViewMode = 'board' | 'tree'

export interface Task {
  id: string
  parentId: string | null
  title: string
  description: string
  status: StatusId
  childIds: string[]
  createdAt: number
  updatedAt: number
  collapsed: boolean
}

export interface PlannerState {
  version: 1
  rootIds: string[]
  tasks: Record<string, Task>
  lastView: ViewMode
}

export type AggregatePhase = 'not-started' | 'in-progress' | 'done' | 'cancelled'

export interface Aggregate {
  phase: AggregatePhase
  blocked: boolean
  done: number
  total: number
  cancelled: number
  started: number
  percent: number | null
}
