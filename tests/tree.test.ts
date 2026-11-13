import { describe, expect, it } from 'vitest'
import {
  aggregateTask,
  collectLeafTasks,
  computeAggregates,
  createEmptyState,
  createTaskEntity,
  getBreadcrumb,
  getLeafTasksInOrder,
  groupLeavesByStatus,
  insertTask,
  moveSiblingByOffset,
  moveSiblingRelative,
  removeSubtree,
  restoreSubtree,
} from '../src/lib/tree'
import type { PlannerState, StatusId } from '../src/lib/types'

function add(
  state: PlannerState,
  id: string,
  parentId: string | null,
  status: StatusId = 'backlog',
  title = id,
): void {
  insertTask(state, createTaskEntity(id, parentId, title, '', status), parentId)
}

function setup(): PlannerState {
  const state = createEmptyState()
  add(state, 'epic', null, 'backlog', 'Epic')
  add(state, 'feature', 'epic', 'backlog', 'Feature')
  add(state, 'story-a', 'feature', 'backlog', 'Story A')
  add(state, 'story-b', 'feature', 'backlog', 'Story B')
  add(state, 'other-root', null, 'in-progress', 'Other root')
  return state
}

describe('aggregation', () => {
  it('marks a parent done when all non-cancelled descendants are done', () => {
    const state = setup()
    state.tasks['story-a'].status = 'done'
    state.tasks['story-b'].status = 'done'

    const feature = aggregateTask(state, 'feature')
    expect(feature.phase).toBe('done')
    expect(feature.percent).toBe(1)
    expect(feature.done).toBe(2)
    expect(aggregateTask(state, 'epic').phase).toBe('done')
  })

  it('reverts a parent when a done leaf becomes active again', () => {
    const state = setup()
    state.tasks['story-a'].status = 'done'
    state.tasks['story-b'].status = 'done'
    expect(aggregateTask(state, 'feature').phase).toBe('done')

    state.tasks['story-b'].status = 'in-progress'
    const feature = aggregateTask(state, 'feature')
    expect(feature.phase).toBe('in-progress')
    expect(feature.done).toBe(1)
    expect(feature.total).toBe(2)
    expect(feature.percent).toBe(0.5)
  })

  it('excludes cancelled leaves from progress and completion', () => {
    const state = setup()
    state.tasks['story-a'].status = 'done'
    state.tasks['story-b'].status = 'cancelled'

    const feature = aggregateTask(state, 'feature')
    expect(feature.total).toBe(1)
    expect(feature.done).toBe(1)
    expect(feature.cancelled).toBe(1)
    expect(feature.percent).toBe(1)
    expect(feature.phase).toBe('done')
  })

  it('treats backlog and next-up as not started', () => {
    const state = setup()
    state.tasks['story-a'].status = 'next-up'
    expect(aggregateTask(state, 'feature').phase).toBe('not-started')
  })

  it('reports blocked while the parent label stays in progress', () => {
    const state = setup()
    state.tasks['story-a'].status = 'done'
    state.tasks['story-b'].status = 'blocked'

    const feature = aggregateTask(state, 'feature')
    expect(feature.phase).toBe('in-progress')
    expect(feature.blocked).toBe(true)
    expect(feature.percent).toBe(0.5)
  })

  it('marks an all-cancelled branch as cancelled', () => {
    const state = setup()
    state.tasks['story-a'].status = 'cancelled'
    state.tasks['story-b'].status = 'cancelled'

    const feature = aggregateTask(state, 'feature')
    expect(feature.phase).toBe('cancelled')
    expect(feature.total).toBe(0)
    expect(feature.percent).toBe(null)
  })

  it('computes every aggregate bottom-up consistently', () => {
    const state = setup()
    state.tasks['story-a'].status = 'done'
    state.tasks['story-b'].status = 'blocked'
    const aggregates = computeAggregates(state)

    expect(aggregates.get('feature')).toEqual(aggregateTask(state, 'feature'))
    expect(aggregates.get('epic')).toEqual(aggregateTask(state, 'epic'))
    expect(aggregates.get('story-a')?.phase).toBe('done')
  })
})

describe('traversal and board projection', () => {
  it('collects only leaves in depth-first sibling order', () => {
    const state = setup()
    add(state, 'story-a1', 'story-a', 'done', 'Story A1')

    expect(collectLeafTasks(state, 'epic').map((task) => task.id)).toEqual([
      'story-a1',
      'story-b',
    ])
    expect(getLeafTasksInOrder(state).map((task) => task.id)).toEqual([
      'story-a1',
      'story-b',
      'other-root',
    ])
  })

  it('groups leaves by hard-coded status and omits parents', () => {
    const state = setup()
    state.tasks['story-a'].status = 'done'
    const grouped = groupLeavesByStatus(state)

    expect(grouped.done.map((task) => task.id)).toEqual(['story-a'])
    expect(grouped['in-progress'].map((task) => task.id)).toEqual(['other-root'])
    expect(grouped.backlog.map((task) => task.id)).toEqual(['story-b'])
    expect(
      Object.values(grouped)
        .flat()
        .some((task) => task.id === 'feature'),
    ).toBe(false)
  })

  it('returns ancestor titles for card breadcrumbs', () => {
    const state = setup()
    expect(getBreadcrumb(state, 'story-a')).toEqual(['Epic', 'Feature'])
    expect(getBreadcrumb(state, 'epic')).toEqual([])
  })
})

describe('sibling ordering', () => {
  it('reorders siblings relative to a target', () => {
    const state = setup()
    add(state, 'story-c', 'feature')

    expect(state.tasks['feature'].childIds).toEqual(['story-a', 'story-b', 'story-c'])
    expect(moveSiblingRelative(state, 'story-c', 'story-a', 'before')).toBe(true)
    expect(state.tasks['feature'].childIds).toEqual(['story-c', 'story-a', 'story-b'])

    expect(moveSiblingRelative(state, 'story-c', 'story-b', 'after')).toBe(true)
    expect(state.tasks['feature'].childIds).toEqual(['story-a', 'story-b', 'story-c'])
  })

  it('refuses to reorder across different parents', () => {
    const state = setup()
    expect(moveSiblingRelative(state, 'story-a', 'other-root', 'before')).toBe(false)
    expect(state.tasks['feature'].childIds).toEqual(['story-a', 'story-b'])
  })

  it('moves by offset and respects boundaries', () => {
    const state = setup()
    expect(moveSiblingByOffset(state, 'story-b', -1)).toBe(true)
    expect(state.tasks['feature'].childIds).toEqual(['story-b', 'story-a'])
    expect(moveSiblingByOffset(state, 'story-b', -1)).toBe(false)
    expect(moveSiblingByOffset(state, 'story-a', 1)).toBe(false)
  })
})

describe('deletion', () => {
  it('removes a subtree and restores it at the same index', () => {
    const state = setup()
    const removed = removeSubtree(state, 'feature')
    expect(removed).not.toBe(null)
    expect(state.tasks['feature']).toBeUndefined()
    expect(state.tasks['story-a']).toBeUndefined()
    expect(state.rootIds).toEqual(['epic', 'other-root'])
    expect(state.tasks['epic'].childIds).toEqual([])

    restoreSubtree(state, removed!)
    expect(state.rootIds).toEqual(['epic', 'other-root'])
    expect(state.tasks['epic'].childIds).toEqual(['feature'])
    expect(state.tasks['feature'].childIds).toEqual(['story-a', 'story-b'])
  })
})
