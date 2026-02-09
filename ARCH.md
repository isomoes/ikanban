# iKanban Architecture

## Overview

iKanban is a terminal Kanban board that supports multiple AI coding agents working in parallel using git worktrees for isolation. Each task gets its own isolated workspace where an agent works independently without conflicts.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Bun |
| Language | TypeScript |
| Terminal UI | Ink (React for terminals) |
| Session / Worktree / Agent | `@opencode-ai/sdk` |
| Package Manager | bun |

## UI Design

### Navigation Model

Three-level view hierarchy with vim-like keyboard navigation:

```
Project View → Task View → Session View
     ↓              ↓              ↓
Select repo    Kanban board   Agent interaction
as project     CRUD tasks     Send prompts, view logs
```

### Keyboard Navigation (Vim-like)

| Key | Action |
|-----|--------|
| `h` | Move left / Go back to previous view |
| `j` | Move down / Select next item |
| `k` | Move up / Select previous item |
| `l` | Move right / Enter selected item |
| `Enter` | Confirm / Enter selected item |
| `Esc` | Cancel / Go back |
| `n` | New (create task/project) |
| `d` | Delete selected item |
| `e` | Edit selected item |
| `r` | Refresh |
| `?` | Show help |

### View 1: Project View

```
┌─────────────────────────────────────────────────────────────────┐
│  iKanban - Projects                                    [?] Help │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  > /home/user/myproject          [3 tasks]                      │
│    /home/user/webapp             [5 tasks]                      │
│    /home/user/api-server         [2 tasks]                      │
│                                                                 │
│  [n] New Project   [d] Delete   [Enter/l] Open                  │
└─────────────────────────────────────────────────────────────────┘
```

### View 2: Task View (Kanban Board)

```
┌─────────────────────────────────────────────────────────────────┐
│  myproject                                      [h] Back  [?]   │
├───────────────┬───────────────┬───────────────┬─────────────────┤
│  Todo         │  InProgress   │  InReview     │  Done           │
├───────────────┼───────────────┼───────────────┼─────────────────┤
│               │               │               │                 │
│ > Fix login   │  Add dark     │  Refactor     │  Setup CI       │
│   bug         │  mode         │  auth         │                 │
│               │               │               │  Update deps    │
│   Add tests   │               │               │                 │
│               │               │               │                 │
├───────────────┴───────────────┴───────────────┴─────────────────┤
│  [n] New Task  [e] Edit  [d] Delete  [Enter/l] Open Session     │
└─────────────────────────────────────────────────────────────────┘
```

### View 3: Session View

```
┌─────────────────────────────────────────────────────────────────┐
│  Task: Fix login bug                            [h] Back  [?]   │
│  Status: Running                                                │
├─────────────────────────────────────────────────────────────────┤
│  Agent Messages                                    [L] Logs     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [User] Fix the login bug in auth.ts                            │
│                                                                 │
│  [Agent] I'll analyze the login function...                     │
│                                                                 │
│  [Tool] Reading file: src/auth.ts                               │
│                                                                 │
│  [Agent] Found the issue. The session token                     │
│          validation is missing...                               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  > Type message...                                              │
│                                                                 │
│  [Enter] Send  [Ctrl+C] Stop Agent  [L] Toggle Logs             │
└─────────────────────────────────────────────────────────────────┘
```

**Log Panel (Toggle with `L`):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Task: Fix login bug                            [h] Back  [?]   │
│  Status: Running                                                │
├────────────────────────────────┬────────────────────────────────┤
│  Agent Messages                │  Logs                          │
├────────────────────────────────┼────────────────────────────────┤
│                                │ [stdout] Server started         │
│  [User] Fix the login bug      │ [event] SessionStatus:Busy     │
│                                │ [event] ToolPart:Read           │
│  [Agent] I'll analyze...       │ [stdout] Reading auth.ts       │
│                                │ [event] ToolPart:Complete       │
│  [Tool] Reading: src/auth.ts   │ [event] MessageUpdated         │
│                                │                                │
├────────────────────────────────┴────────────────────────────────┤
│  > Type message...                                              │
│  [Enter] Send  [Ctrl+C] Stop  [L] Hide Logs                     │
└─────────────────────────────────────────────────────────────────┘
```

### State Machine

```
                    ┌──────────────┐
                    │ Project View │
                    └──────┬───────┘
                           │ l/Enter (select project)
                           ↓
                    ┌──────────────┐
            ┌───────│  Task View   │
            │       └──────┬───────┘
            │ h/Esc        │ l/Enter
            ↓              ↓
     ┌──────────────┐ ┌──────────────┐
     │ Project View │ │ Session View │
     └──────────────┘ └──────────────┘
```

### Focus Management

```typescript
type AppView =
  | { kind: "projects" }
  | { kind: "tasks"; projectId: string }
  | { kind: "session"; taskId: string; sessionId: string }

interface AppState {
  view: AppView
  selectedIndex: number
  columnIndex: number   // Task View
  showLogs: boolean     // Session View
  inputFocused: boolean // Session View input
}
```

## Core Concept

```
Main Repo (e.g., /home/user/myproject)
├── Task A → Worktree A (branch: task/123-feature-a) → Agent 1
├── Task B → Worktree B (branch: task/456-feature-b) → Agent 2
├── Task C → Worktree C (branch: task/789-bugfix-c) → Agent 3
└── Task D → Worktree D (branch: task/012-refactor-d) → Agent 4
```

## Session & Workspace via `@opencode-ai/sdk`

All session management, worktree lifecycle, and agent communication are handled through `@opencode-ai/sdk`. The SDK provides:

- Session creation and management
- Worktree creation/cleanup
- Agent spawning and communication
- Event streaming (SSE)
- Message sending and receiving

iKanban acts as a UI layer on top of the SDK — it does not implement its own executor, HTTP client, or worktree manager.

### Worktree Lifecycle

```
1. User Creates Task in "Todo" column
   → Store task in local state

2. User Starts Task → SDK creates session
   → sdk.session.create({ directory: worktreePath })
   → Worktree created, agent spawned
   → Task status → InProgress

3. Agent Execution (in worktree)
   → Events streamed via SDK
   → UI renders messages and tool calls in real time

4. Session Complete
   → Agent finishes, SDK emits idle/complete
   → Task status → InReview or Done

5. Cleanup
   → SDK handles worktree removal
```

## Project Structure

```
ikanban/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx            # entry point
│   ├── app.tsx              # root Ink component, view router
│   ├── state/
│   │   ├── store.ts         # app state (zustand or useReducer)
│   │   └── types.ts         # AppView, Task, Project types
│   ├── views/
│   │   ├── ProjectView.tsx
│   │   ├── TaskView.tsx
│   │   └── SessionView.tsx
│   ├── components/
│   │   ├── Board.tsx        # kanban columns layout
│   │   ├── Column.tsx       # single column
│   │   ├── Card.tsx         # task card
│   │   ├── LogPanel.tsx     # session log viewer
│   │   └── Input.tsx        # prompt input
│   └── hooks/
│       ├── useKeyboard.ts   # vim keybindings
│       └── useSession.ts    # wraps @opencode-ai/sdk session
```

## Dependencies

```json
{
  "dependencies": {
    "ink": "^5",
    "react": "^18",
    "@opencode-ai/sdk": "latest"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/react": "^18"
  }
}
```

## Data Model

```typescript
interface Project {
  id: string
  name: string
  path: string
  createdAt: Date
}

type TaskStatus = "Todo" | "InProgress" | "InReview" | "Done"

interface Task {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  createdAt: Date
}

interface Session {
  id: string
  taskId: string
  worktreePath?: string
  branchName?: string
  status: "Running" | "Completed" | "Failed" | "Killed"
  createdAt: Date
  startedAt?: Date
  finishedAt?: Date
}
```

## Storage

Local JSON file or SQLite via `better-sqlite3` (TBD). For MVP, a simple JSON file at `~/.ikanban/data.json` is sufficient.

## App Actions

| Category | Actions |
|----------|---------|
| Projects | List, Get, Create, Update, Delete |
| Tasks | List, Get, Create, Update, Delete |
| Sessions | List, Get, Create (via SDK), Stop (via SDK), GetLogs, Cleanup |
