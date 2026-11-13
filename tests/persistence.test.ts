import { describe, expect, it } from 'vitest'
import { parseState, sanitizeState } from '../src/lib/persistence'

function task(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    parentId: null,
    title: id,
    description: '',
    status: 'backlog',
    childIds: [],
    createdAt: 1,
    updatedAt: 1,
    collapsed: false,
    ...patch,
  }
}

describe('state sanitization', () => {
  it('recovers a healthy document without changing its structure', () => {
    const state = sanitizeState({
      version: 1,
      rootIds: ['a'],
      lastView: 'tree',
      tasks: {
        a: task('a', { childIds: ['b'] }),
        b: task('b', { parentId: 'a', status: 'done' }),
      },
    })

    expect(state.rootIds).toEqual(['a'])
    expect(state.tasks.a.childIds).toEqual(['b'])
    expect(state.tasks.b.parentId).toBe('a')
    expect(state.tasks.b.status).toBe('done')
    expect(state.lastView).toBe('tree')
  })

  it('drops missing children, self references, and duplicates', () => {
    const state = sanitizeState({
      rootIds: ['a'],
      tasks: {
        a: task('a', { childIds: ['b', 'b', 'ghost', 'a'] }),
        b: task('b', { parentId: 'a' }),
      },
    })

    expect(state.tasks.a.childIds).toEqual(['b'])
    expect(state.rootIds).toEqual(['a'])
  })

  it('breaks cycles and assigns a single parent', () => {
    const state = sanitizeState({
      rootIds: ['a'],
      tasks: {
        a: task('a', { childIds: ['b'] }),
        b: task('b', { childIds: ['a'] }),
      },
    })

    expect(state.rootIds).toEqual(['a'])
    expect(state.tasks.a.parentId).toBe(null)
    expect(state.tasks.b.parentId).toBe('a')
    expect(state.tasks.b.childIds).toEqual([])
  })

  it('recovers orphaned tasks as roots', () => {
    const state = sanitizeState({
      rootIds: [],
      tasks: {
        a: task('a', { childIds: ['b'] }),
        b: task('b', { parentId: 'a' }),
        orphan: task('orphan'),
      },
    })

    expect(state.rootIds).toEqual(['a', 'orphan'])
    expect(state.tasks.a.parentId).toBe(null)
    expect(state.tasks.orphan.parentId).toBe(null)
  })

  it('normalizes invalid fields and statuses', () => {
    const state = sanitizeState({
      lastView: 'nonsense',
      rootIds: ['a'],
      tasks: {
        a: {
          id: 'a',
          title: '   ',
          status: 'not-a-status',
          childIds: 'nope',
          collapsed: 'yes',
        },
      },
    })

    expect(state.tasks.a.title).toBe('Untitled task')
    expect(state.tasks.a.status).toBe('backlog')
    expect(state.tasks.a.childIds).toEqual([])
    expect(state.tasks.a.collapsed).toBe(false)
    expect(state.lastView).toBe('board')
  })

  it('preserves the first parent when a child is referenced twice', () => {
    const state = sanitizeState({
      rootIds: ['a', 'b'],
      tasks: {
        a: task('a', { childIds: ['c'] }),
        b: task('b', { childIds: ['c'] }),
        c: task('c'),
      },
    })

    expect(state.rootIds).toEqual(['a', 'b'])
    expect(state.tasks.c.parentId).toBe('a')
    expect(state.tasks.a.childIds).toEqual(['c'])
    expect(state.tasks.b.childIds).toEqual([])
  })
})

describe('parsing', () => {
  it('returns an empty planner for missing data', () => {
    const result = parseState(null)
    expect(result.state.rootIds).toEqual([])
    expect(result.warning).toBe(null)
  })

  it('warns and recovers from malformed JSON', () => {
    const result = parseState('{not json')
    expect(result.state.rootIds).toEqual([])
    expect(result.warning).toMatch(/corrupted/i)
  })

  it('warns when the stored value is not an object', () => {
    const result = parseState('42')
    expect(result.state.rootIds).toEqual([])
    expect(result.warning).toMatch(/could not be read/i)
  })
})
