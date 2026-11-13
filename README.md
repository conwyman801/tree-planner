# Recursive Planner

A browser-only planning app with infinite nesting. Every task can contain subtasks, subtasks can contain more subtasks, and parents derive their status from their leaves.

All data is stored in `localStorage`; there is no backend, account, or network request.

## Features

- **Board view** — Trello-style columns for the six fixed statuses: Backlog, Next Up, In Progress, Blocked, Done, Cancelled. Only leaf tasks appear on the board.
- **Tree view** — custom SVG tree of every task with parent-child edges, pan/zoom, collapse/expand, and sibling reordering.
- **Derived completion** — a parent is Done when all non-cancelled leaf descendants are Done. Cancelled work is excluded from progress and completion.
- **Completion rings** — parents show percent complete with colours for not started, in progress, blocked, and done.
- **Nested creation** — create top-level tasks from the header or a column, and subtasks from any tree node or board card.
- **Local persistence** — debounced autosave, JSON export/import, clear planner, and corrupt-storage recovery.
- **Keyboard support** — Alt+Up/Down reorders siblings; cards and nodes are keyboard focusable.

## Stack

Svelte 5 + Vite + TypeScript, with plain CSS. Dragging uses the native HTML5 drag and drop API, so no runtime UI dependencies are required.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # svelte-check + TypeScript
npm run test       # Vitest domain tests
npm run build      # static build in dist/
```

## Data model

```ts
type StatusId =
  | 'backlog' | 'next-up' | 'in-progress'
  | 'blocked' | 'done' | 'cancelled'

interface Task {
  id: string
  parentId: string | null
  title: string
  description: string
  status: StatusId       // authoritative only while a leaf
  childIds: string[]     // ordered siblings
  createdAt: number
  updatedAt: number
  collapsed: boolean
}
```

Sibling order is stored in `rootIds` / `childIds`. Parent status is never persisted; it is recomputed from leaf descendants. The stored `status` is kept so a task returns to its previous status if all of its subtasks are deleted.

## Status rules

- Backlog and Next Up count as not started.
- Any mix of started work that is not fully done shows the parent as In Progress.
- A blocked leaf turns the parent's completion ring red while the parent keeps the In Progress label.
- Cancelled leaves are excluded from the denominator and do not prevent a parent from becoming Done.
- A branch whose leaves are all cancelled is shown as Cancelled.
