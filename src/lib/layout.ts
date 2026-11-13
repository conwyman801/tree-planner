import type { PlannerState } from './types'

export const NODE_WIDTH = 244
export const NODE_HEIGHT = 88
export const H_GAP = 76
export const V_GAP = 16
export const ROOT_GAP = 40
export const PADDING = 48

export interface LayoutNode {
  id: string
  x: number
  y: number
  width: number
  height: number
  depth: number
  hasChildren: boolean
}

export interface LayoutEdge {
  from: string
  to: string
  path: string
}

export interface TreeLayout {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  width: number
  height: number
}

function edgePath(
  parent: { x: number; y: number },
  child: { x: number; y: number },
): string {
  const x1 = parent.x + NODE_WIDTH
  const y1 = parent.y + NODE_HEIGHT / 2
  const x2 = child.x
  const y2 = child.y + NODE_HEIGHT / 2
  const control = Math.max(40, (x2 - x1) * 0.5)
  return `M ${x1} ${y1} C ${x1 + control} ${y1}, ${x2 - control} ${y2}, ${x2} ${y2}`
}

export function computeLayout(state: PlannerState): TreeLayout {
  const nodes: LayoutNode[] = []
  const edges: LayoutEdge[] = []
  const heightCache = new Map<string, number>()

  const subtreeHeight = (id: string): number => {
    const cached = heightCache.get(id)
    if (cached !== undefined) return cached
    const task = state.tasks[id]
    if (!task) return 0
    const children = task.collapsed ? [] : task.childIds.filter((childId) => !!state.tasks[childId])
    const height =
      children.length === 0
        ? NODE_HEIGHT
        : Math.max(
            NODE_HEIGHT,
            children.reduce((sum, childId) => sum + subtreeHeight(childId), 0) +
              V_GAP * (children.length - 1),
          )
    heightCache.set(id, height)
    return height
  }

  const maxDepth = { value: 0 }

  const place = (id: string, top: number, depth: number): void => {
    const task = state.tasks[id]
    if (!task) return
    const height = subtreeHeight(id)
    const x = PADDING + depth * (NODE_WIDTH + H_GAP)
    maxDepth.value = Math.max(maxDepth.value, depth)

    const node: LayoutNode = {
      id,
      x,
      y: top,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      depth,
      hasChildren: task.childIds.length > 0,
    }
    nodes.push(node)

    if (task.collapsed) return
    const children = task.childIds.filter((childId) => !!state.tasks[childId])
    const childNodes: LayoutNode[] = []
    let childTop = top
    for (const childId of children) {
      const before = nodes.length
      const childHeight = subtreeHeight(childId)
      place(childId, childTop, depth + 1)
      for (let index = before; index < nodes.length; index++) {
        if (nodes[index].id === childId) {
          childNodes.push(nodes[index])
          break
        }
      }
      childTop += childHeight + V_GAP
    }

    if (childNodes.length > 0) {
      const first = childNodes[0]
      const last = childNodes[childNodes.length - 1]
      node.y = (first.y + last.y) / 2
    }
  }

  let cursorY = PADDING
  for (const rootId of state.rootIds) {
    if (!state.tasks[rootId]) continue
    const height = subtreeHeight(rootId)
    place(rootId, cursorY, 0)
    cursorY += height + ROOT_GAP
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) {
    const task = state.tasks[node.id]
    if (!task || task.collapsed) continue
    for (const childId of task.childIds) {
      const child = nodeById.get(childId)
      if (!child) continue
      edges.push({
        from: node.id,
        to: childId,
        path: edgePath(node, child),
      })
    }
  }

  const contentHeight = cursorY > PADDING ? cursorY - ROOT_GAP + PADDING : 480
  const contentWidth =
    nodes.length === 0 ? 720 : PADDING * 2 + maxDepth.value * (NODE_WIDTH + H_GAP) + NODE_WIDTH

  return {
    nodes,
    edges,
    width: Math.max(720, contentWidth),
    height: Math.max(480, contentHeight),
  }
}
