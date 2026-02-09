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

## `@opencode-ai/sdk` Integration

`@opencode-ai/sdk@1.1.53` — iKanban is a UI layer on top of this SDK. No custom executor, HTTP client, or SSE parser needed.

### SDK Entry Points

```typescript
import { createOpencode } from "@opencode-ai/sdk"
import { createOpencodeClient } from "@opencode-ai/sdk/client"
import { createOpencodeServer } from "@opencode-ai/sdk/server"
```

| Import | Use Case |
|--------|----------|
| `createOpencode(opts?)` | All-in-one: spawns server + returns `{ client, server }` |
| `createOpencodeServer(opts?)` | Server only: `{ url, close() }` |
| `createOpencodeClient(config?)` | Client only: connect to existing server |

Per-worktree pattern: call `createOpencode()` for each worktree directory to get an isolated server+client pair.

### OpencodeClient API Surface

The SDK client (`OpencodeClient`) exposes these namespaced sub-clients:

| Namespace | Key Methods | iKanban Usage |
|-----------|-------------|---------------|
| `client.session` | `create`, `list`, `get`, `delete`, `update`, `status`, `prompt`, `promptAsync`, `messages`, `message`, `abort`, `fork`, `diff`, `summarize`, `todo`, `children`, `share`, `unshare`, `shell`, `command`, `init`, `revert`, `unrevert` | Core: create sessions, send prompts, read messages, abort |
| `client.event` | `subscribe` | Core: SSE stream for real-time UI updates |
| `client.project` | `list`, `current` | Project discovery |
| `client.path` | `get` | Get `{ state, config, worktree, directory }` paths |
| `client.vcs` | `get` | Get current branch info |
| `client.config` | `get`, `update`, `providers` | Config read/write |
| `client.app` | `log`, `agents` | List available agents |
| `client.file` | `list`, `read`, `status` | File browsing |
| `client.find` | `text`, `files`, `symbols` | Code search |
| `client.tool` | `ids`, `list` | Tool introspection |
| `client.provider` | `list`, `auth`, `oauth.*` | Provider/auth |
| `client.mcp` | `status`, `add`, `connect`, `disconnect`, `auth.*` | MCP servers |
| `client.pty` | `list`, `create`, `remove`, `get`, `update`, `connect` | Terminal sessions |
| `client.instance` | `dispose` | Shutdown server |
| `client.global` | `event` | Global SSE (cross-directory) |
| `client.lsp` | `status` | LSP status |
| `client.formatter` | `status` | Formatter status |
| `client.tui` | `appendPrompt`, `submitPrompt`, `clearPrompt`, `executeCommand`, `showToast`, `publish`, `control.*` | TUI control |
| `client.command` | `list` | List slash commands |

### SDK Types Used by iKanban

```typescript
// from @opencode-ai/sdk
import type {
  Session,           // { id, projectID, directory, parentID?, title, version, time, summary?, share?, revert? }
  SessionStatus,     // { type: "idle" } | { type: "busy" } | { type: "retry", attempt, message, next }
  Message,           // UserMessage | AssistantMessage
  UserMessage,       // { id, sessionID, role: "user", time, agent, model, ... }
  AssistantMessage,  // { id, sessionID, role: "assistant", time, parentID, modelID, cost, tokens, error?, ... }
  Part,              // TextPart | ToolPart | ReasoningPart | FilePart | StepStartPart | StepFinishPart | ...
  TextPart,          // { type: "text", text, ... }
  ToolPart,          // { type: "tool", tool, callID, state: ToolState, ... }
  ToolState,         // ToolStatePending | ToolStateRunning | ToolStateCompleted | ToolStateError
  Event,             // Union of 30+ event types
  Permission,        // { id, type, sessionID, messageID, title, metadata, ... }
  Todo,              // { id, content, status, priority }
  FileDiff,          // { file, before, after, additions, deletions }
  Project,           // { id, worktree, vcsDir?, vcs?, time }
  Config,            // Full opencode config shape
} from "@opencode-ai/sdk"
```

### Key SSE Events for UI

```typescript
// Subscribe to real-time updates
const stream = await client.event.subscribe()

// Events iKanban cares about:
type RelevantEvents =
  | EventSessionStatus      // "session.status" → idle/busy/retry
  | EventMessageUpdated     // "message.updated" → new/updated message
  | EventMessagePartUpdated // "message.part.updated" → streaming text/tool parts + delta
  | EventPermissionUpdated  // "permission.updated" → tool needs approval
  | EventPermissionReplied  // "permission.replied" → approval given
  | EventTodoUpdated        // "todo.updated" → agent todo list changed
  | EventSessionCreated     // "session.created"
  | EventSessionUpdated     // "session.updated"
  | EventSessionError       // "session.error"
  | EventFileEdited         // "file.edited"
```

### Worktree Lifecycle

```
1. User Creates Task in "Todo" column
   → Store task in iKanban local state

2. User Starts Task
   → git worktree add <path> -b task/<id>-<slug>   (iKanban runs this)
   → const { client, server } = await createOpencode({ config: { directory: worktreePath } })
   → const session = await client.session.create()
   → await client.session.prompt({ path: { id: session.id }, body: { parts: [{ type: "text", text: prompt }] } })
   → Task status → InProgress

3. Agent Execution (in worktree)
   → const stream = await client.event.subscribe()
   → UI renders EventMessagePartUpdated (streaming text + tool calls)
   → EventSessionStatus { type: "busy" } while working
   → EventPermissionUpdated when tool needs approval
     → client.postSessionIdPermissionsPermissionId({ path: { id, permissionId }, body: "allow" })

4. Session Complete
   → EventSessionStatus { type: "idle" } → agent done
   → await client.session.diff({ path: { id } }) → show file changes
   → Task status → InReview or Done

5. Follow-up Prompt
   → await client.session.prompt({ path: { id }, body: { parts: [...] } })
   → or fork: await client.session.fork({ path: { id }, body: { messageID } })

6. Cleanup
   → await client.session.abort({ path: { id } })   (if running)
   → server.close()
   → git worktree remove <path>                       (iKanban runs this)
```

### Multi-Agent Pattern

Each task gets its own opencode server+client pair, isolated by worktree directory:

```typescript
// Per-task agent instance
interface AgentInstance {
  taskId: string
  worktreePath: string
  client: OpencodeClient
  server: { url: string; close(): void }
  sessionId: string
}

// iKanban manages a Map<taskId, AgentInstance>
// Each instance is fully independent — different directory, different server, different port
```

## Project Structure

```
ikanban/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx
│   ├── app.tsx
│   ├── state/
│   │   ├── store.ts
│   │   └── types.ts
│   ├── views/
│   │   ├── ProjectView.tsx
│   │   ├── TaskView.tsx
│   │   └── SessionView.tsx
│   ├── components/
│   │   ├── Board.tsx
│   │   ├── Column.tsx
│   │   ├── Card.tsx
│   │   ├── LogPanel.tsx
│   │   └── Input.tsx
│   ├── hooks/
│   │   ├── useKeyboard.ts
│   │   ├── useSession.ts    # wraps client.session + client.event.subscribe
│   │   └── useAgent.ts      # manages createOpencode() lifecycle per task
│   └── agent/
│       ├── instance.ts       # AgentInstance type + create/destroy helpers
│       └── registry.ts       # Map<taskId, AgentInstance> management
```

## Dependencies

```json
{
  "dependencies": {
    "ink": "^5",
    "react": "^18",
    "@opencode-ai/sdk": "^1.1.53"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/react": "^18"
  }
}
```

## Data Model

iKanban owns task/project data. Session data comes from the SDK.

```typescript
// iKanban-owned (stored locally)
interface IKanbanProject {
  id: string
  name: string
  path: string
  createdAt: number
}

type TaskStatus = "Todo" | "InProgress" | "InReview" | "Done"

interface IKanbanTask {
  id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  sessionId?: string       // links to SDK Session.id
  worktreePath?: string
  branchName?: string
  createdAt: number
}

// SDK-owned (queried via client.session.get / client.session.messages)
// Session, Message, Part, SessionStatus, Todo, FileDiff — all from @opencode-ai/sdk
```

## Storage

Local JSON file at `~/.ikanban/data.json` for MVP. Only stores iKanban-owned data (projects, tasks). Session/message history lives in the SDK's own storage.

## iKanban Responsibilities vs SDK

| Concern | Owner |
|---------|-------|
| Task CRUD, kanban columns, project list | iKanban |
| Git worktree add/remove | iKanban (shell commands) |
| Agent server spawn/shutdown | SDK (`createOpencode` / `server.close`) |
| Session create/prompt/abort | SDK (`client.session.*`) |
| Real-time event streaming | SDK (`client.event.subscribe`) |
| Message & part storage | SDK |
| Permission handling | SDK (`client.postSessionIdPermissionsPermissionId`) |
| Tool execution | SDK |
| Terminal UI rendering | iKanban (Ink) |
