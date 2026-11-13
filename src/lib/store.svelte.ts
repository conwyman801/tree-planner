import {
  loadFromStorage,
  parseState,
  saveToStorage,
  serializeState,
} from './persistence'
import {
  createEmptyState,
  createTaskEntity,
  moveSiblingByOffset,
  moveSiblingRelative,
  moveTaskRelative,
  removeSubtree,
  restoreSubtree,
  setAllCollapsed,
  setTaskStatus,
  toggleCollapse,
  insertTask,
} from './tree'
import type { RemovedSubtree } from './tree'
import type { DropPosition, PlannerState, StatusId, Task, ViewMode } from './types'

type SaveStatus = 'saved' | 'saving' | 'error'

interface ToastState {
  id: number
  message: string
  actionLabel?: string
  action?: () => void
}

interface NewTaskRequest {
  parentId: string | null
  status: StatusId
}

let toastSequence = 0

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

class PlannerStore {
  state = $state<PlannerState>(createEmptyState())
  selectedTaskId = $state<string | null>(null)
  newTaskRequest = $state<NewTaskRequest | null>(null)
  saveStatus = $state<SaveStatus>('saved')
  toast = $state<ToastState | null>(null)
  storageWarning = $state<string | null>(null)

  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private toastTimer: ReturnType<typeof setTimeout> | null = null
  private lastDelete: RemovedSubtree | null = null

  constructor() {
    const loaded = loadFromStorage()
    this.state = loaded.state
    this.storageWarning = loaded.warning
  }

  get selectedTask(): Task | undefined {
    return this.selectedTaskId ? this.state.tasks[this.selectedTaskId] : undefined
  }

  addTask(
    parentId: string | null,
    title: string,
    description = '',
    status: StatusId = 'backlog',
  ): string {
    const id = createId()
    const task = createTaskEntity(id, parentId, title, description, status)
    const validParent = parentId && this.state.tasks[parentId] ? parentId : null
    insertTask(this.state, task, validParent)
    this.selectedTaskId = id
    this.scheduleSave()
    return id
  }

  requestNewTask(parentId: string | null = null, status: StatusId = 'backlog'): void {
    this.newTaskRequest = { parentId, status }
  }

  cancelNewTask(): void {
    this.newTaskRequest = null
  }

  updateTask(
    id: string,
    patch: Partial<Pick<Task, 'title' | 'description' | 'status'>>,
  ): void {
    const task = this.state.tasks[id]
    if (!task) return
    if (patch.title !== undefined) {
      task.title = patch.title.trim() || 'Untitled task'
    }
    if (patch.description !== undefined) {
      task.description = patch.description
    }
    if (patch.status !== undefined && task.childIds.length === 0) {
      task.status = patch.status
    }
    task.updatedAt = Date.now()
    this.scheduleSave()
  }

  setStatus(id: string, status: StatusId): void {
    if (setTaskStatus(this.state, id, status)) this.scheduleSave()
  }

  selectTask(id: string | null): void {
    this.selectedTaskId = id
  }

  toggleTaskCollapse(id: string): void {
    toggleCollapse(this.state, id)
    this.scheduleSave()
  }

  expandAll(): void {
    setAllCollapsed(this.state, false)
    this.scheduleSave()
  }

  collapseAll(): void {
    setAllCollapsed(this.state, true)
    this.scheduleSave()
  }

  moveSiblingRelative(
    draggedId: string,
    targetId: string,
    position: 'before' | 'after',
  ): void {
    if (moveSiblingRelative(this.state, draggedId, targetId, position)) {
      this.scheduleSave()
    }
  }

  moveSiblingByOffset(id: string, offset: number): void {
    if (moveSiblingByOffset(this.state, id, offset)) {
      this.scheduleSave()
    }
  }

  moveTaskRelative(
    draggedId: string,
    targetId: string,
    position: DropPosition,
  ): void {
    if (moveTaskRelative(this.state, draggedId, targetId, position)) {
      this.scheduleSave()
    }
  }

  deleteTask(id: string): void {
    const task = this.state.tasks[id]
    if (!task) return
    const title = task.title
    const removed = removeSubtree(this.state, id)
    if (!removed) return
    this.lastDelete = removed
    if (
      this.selectedTaskId &&
      removed.tasks.some((removedTask) => removedTask.id === this.selectedTaskId)
    ) {
      this.selectedTaskId = null
    }
    this.showToast(`Deleted “${title}”`, 'Undo', () => this.undoDelete())
    this.scheduleSave()
  }

  undoDelete(): void {
    if (!this.lastDelete) return
    const removed = this.lastDelete
    this.lastDelete = null
    restoreSubtree(this.state, removed)
    this.selectedTaskId = removed.rootId
    this.dismissToast()
    this.showToast('Task restored')
    this.scheduleSave()
  }

  setView(view: ViewMode): void {
    if (this.state.lastView === view) return
    this.state.lastView = view
    this.scheduleSave()
  }

  resetPlanner(): void {
    const view = this.state.lastView
    this.state = createEmptyState(view)
    this.selectedTaskId = null
    this.lastDelete = null
    this.scheduleSave()
    this.showToast('Planner cleared')
  }

  exportToFile(): void {
    if (typeof document === 'undefined') return
    const blob = new Blob([serializeState(this.state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `recursive-planner-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    this.showToast('Planner exported')
  }

  async importFromFile(file: File): Promise<void> {
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        this.showToast('Import failed: file is not valid JSON')
        return
      }
      const loaded = parseState(JSON.stringify(parsed))
      if (Object.keys(loaded.state.tasks).length === 0) {
        this.showToast('Import failed: no tasks found in file')
        return
      }
      this.state = loaded.state
      this.selectedTaskId = null
      this.scheduleSave()
      this.showToast('Planner imported')
    } catch {
      this.showToast('Import failed: could not read file')
    }
  }

  saveNow(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    const success = saveToStorage(this.state)
    this.saveStatus = success ? 'saved' : 'error'
  }

  flush = (): void => {
    this.saveNow()
  }

  scheduleSave(): void {
    this.saveStatus = 'saving'
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.saveNow()
    }, 250)
  }

  showToast(message: string, actionLabel?: string, action?: () => void): void {
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toast = { id: ++toastSequence, message, actionLabel, action }
    this.toastTimer = setTimeout(() => {
      this.toast = null
      this.toastTimer = null
    }, 5000)
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer)
      this.toastTimer = null
    }
    this.toast = null
  }
}

export const planner = new PlannerStore()
