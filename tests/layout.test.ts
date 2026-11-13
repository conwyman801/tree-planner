import { describe, expect, it } from 'vitest'
import { computeLayout, NODE_HEIGHT, NODE_WIDTH, PADDING } from '../src/lib/layout'
import { createEmptyState, createTaskEntity, insertTask } from '../src/lib/tree'
import type { PlannerState, StatusId } from '../src/lib/types'

function add(
  state: PlannerState,
  id: string,
  parentId: string | null,
  status: StatusId = 'backlog',
): void {
  insertTask(state, createTaskEntity(id, parentId, id, '', status), parentId)
}

function setup(): PlannerState {
  const state = createEmptyState()
  add(state, 'root')
  add(state, 'a', 'root')
  add(state, 'b', 'root')
  add(state, 'a1', 'a')
  add(state, 'a2', 'a')
  add(state, 'other')
  return state
}

describe('tree layout', () => {
  it('places every visible task and connects each parent to its children', () => {
    const state = setup()
    const layout = computeLayout(state)

    expect(layout.nodes.map((node) => node.id).sort()).toEqual(
      ['a', 'a1', 'a2', 'b', 'other', 'root'].sort(),
    )
    expect(layout.edges).toHaveLength(4)
    expect(layout.edges.map((edge) => `${edge.from}->${edge.to}`).sort()).toEqual(
      ['root->a', 'root->b', 'a->a1', 'a->a2'].sort(),
    )
  })

  it('centers parents between their children', () => {
    const state = setup()
    const layout = computeLayout(state)
    const root = layout.nodes.find((node) => node.id === 'root')!
    const a = layout.nodes.find((node) => node.id === 'a')!
    const b = layout.nodes.find((node) => node.id === 'b')!

    const rootCenter = root.y + NODE_HEIGHT / 2
    const childrenCenter = (a.y + NODE_HEIGHT / 2 + (b.y + NODE_HEIGHT / 2)) / 2
    expect(rootCenter).toBeCloseTo(childrenCenter, 5)
  })

  it('does not overlap siblings', () => {
    const state = setup()
    const layout = computeLayout(state)
    for (let depth = 0; depth <= 2; depth++) {
      const nodes = layout.nodes
        .filter((node) => node.depth === depth)
        .sort((left, right) => left.y - right.y)
      for (let index = 1; index < nodes.length; index++) {
        expect(nodes[index].y).toBeGreaterThanOrEqual(
          nodes[index - 1].y + nodes[index - 1].height,
        )
      }
    }
  })

  it('hides descendants of collapsed nodes', () => {
    const state = setup()
    state.tasks['a'].collapsed = true
    const layout = computeLayout(state)

    expect(layout.nodes.map((node) => node.id)).not.toContain('a1')
    expect(layout.nodes.map((node) => node.id)).not.toContain('a2')
    expect(layout.edges.some((edge) => edge.from === 'a')).toBe(false)
  })

  it('uses stable spacing and starts at the padding offset', () => {
    const state = setup()
    const layout = computeLayout(state)
    const root = layout.nodes.find((node) => node.id === 'root')!
    const other = layout.nodes.find((node) => node.id === 'other')!

    expect(root.x).toBe(PADDING)
    expect(root.width).toBe(NODE_WIDTH)
    expect(other.y).toBeGreaterThan(root.y)
    expect(layout.width).toBeGreaterThanOrEqual(720)
    expect(layout.height).toBeGreaterThanOrEqual(480)
  })

  it('returns a usable canvas for an empty planner', () => {
    const layout = computeLayout(createEmptyState())
    expect(layout.nodes).toEqual([])
    expect(layout.edges).toEqual([])
    expect(layout.width).toBe(720)
    expect(layout.height).toBe(480)
  })
})
