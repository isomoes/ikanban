# iKanban Multi-Agent Architecture

## Overview

iKanban is a Kanban board system that supports multiple AI coding agents working in parallel using git worktrees for isolation. Each task can have its own isolated workspace where an agent works independently without conflicts.

## Tech Stack

### Frontend (Web UI)

- **Framework**: [Leptos](https://leptos.dev/) - Full-stack Rust web framework with fine-grained reactivity
  - SSR (Server-Side Rendering) with hydration for fast initial load
  - `#[server]` functions for seamless client-server communication
  - Fine-grained reactivity - updates at signal level, not component level
  - No Virtual DOM by default - direct DOM manipulation
  - WASM compilation for client-side interactivity

- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4
  - Utility-first CSS framework
  - Compiled CSS (only used classes included)
  - Integration via `cargo-leptos` build pipeline

- **Build Tool**: [cargo-leptos](https://github.com/leptos-rs/cargo-leptos)
  - Manages both server and client builds
  - Hot reload support
  - WASM optimization

### Backend

- **Web Server**: [Axum](https://github.com/tokio-rs/axum)
  - Tokio-based async web framework
  - Tower middleware ecosystem
  - Native integration with Leptos SSR

- **Database**: SQLite via [SQLx](https://github.com/launchbadge/sqlx)
  - Compile-time checked SQL queries
  - Async database operations
  - Migrations support

- **Async Runtime**: [Tokio](https://tokio.rs/)
  - Async I/O, networking, scheduling
  - Multi-threaded runtime

### Core Libraries

| Library                | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `serde`                | Serialization/deserialization for server functions |
| `tower` / `tower-http` | HTTP middleware (CORS, logging, compression)       |
| `tracing`              | Structured logging and diagnostics                 |
| `thiserror` / `anyhow` | Error handling                                     |

### Agent Integration

- **Protocol**: [agent-client-protocol](https://crates.io/crates/agent-client-protocol) (Rust)
- **Process Management**: Tokio spawn with stdout/stderr capture
- **Workspace Isolation**: Git worktrees

### Project Structure

```
ikanban/
├── Cargo.toml              # Workspace manifest
├── src/
│   ├── main.rs             # Server entry point
│   ├── lib.rs              # Shared code (components, server fns)
│   ├── app.rs              # Root App component
│   ├── components/         # UI components
│   │   ├── board.rs        # Kanban board
│   │   ├── task.rs         # Task card
│   │   ├── session.rs      # Agent session view
│   │   └── ...
│   ├── server/             # Server-only code (#[cfg(feature = "ssr")])
│   │   ├── db.rs           # Database operations
│   │   ├── worktree.rs     # Git worktree management
│   │   └── agent.rs        # Agent process management
│   └── api.rs              # #[server] functions
├── style/
│   └── main.css            # Tailwind entry point
├── public/                 # Static assets
└── migrations/             # SQLx migrations
```

### Feature Flags (Cargo.toml)

```toml
[features]
hydrate = ["leptos/hydrate"]
ssr = [
    "dep:axum",
    "dep:tokio",
    "dep:tower",
    "dep:tower-http",
    "dep:leptos_axum",
    "dep:sqlx",
    "leptos/ssr",
]
```

### Development Commands

```bash
# Install cargo-leptos
cargo install cargo-leptos

# Development with hot reload
cargo leptos watch

# Production build
cargo leptos build --release

# Run migrations
sqlx migrate run
```

## Core Concept

```
Main Repo (e.g., /home/user/myproject)
├── Task A → Worktree A (branch: task/123-feature-a) → Agent 1
├── Task B → Worktree B (branch: task/456-feature-b) → Agent 2
├── Task C → Worktree C (branch: task/789-bugfix-c) → Agent 3
└── Task D → Worktree D (branch: task/012-refactor-d) → Agent 4
```

Each task gets its own isolated workspace (git worktree) where an agent can work independently without conflicts.

## Worktree Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│  1. User Creates Task in "Todo" column                     │
└─────────────────┬───────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────┐
│  2. User Starts Task → Move to "InProgress"                │
│     • Create Session                                        │
│     • Generate branch name: `task/{task_id}-{slug}`        │
│     • Create git worktree:                                  │
│       `git worktree add ~/.ikanban/worktrees/task-{id}`    │
│     • Store worktree_path in session                        │
└─────────────────┬───────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Agent Execution (in worktree)                          │
│     • Create ExecutionProcess (run_reason: 'CodingAgent')  │
│     • Spawn agent with working_dir = worktree_path         │
│     • Agent works in isolated worktree                      │
│     • Track turns in CodingAgentTurn                       │
│     • Agent makes commits in worktree branch               │
└─────────────────┬───────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Session Complete                                        │
│     • Push branch to remote (optional)                      │
│     • Create PR or merge directly                          │
│     • Update session status: 'Completed'                   │
│     • Move task to "InReview" or "Done"                    │
└─────────────────┬───────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Cleanup (manual or automatic)                          │
│     • Remove worktree: `git worktree remove`               │
│     • Delete local branch (optional)                       │
└─────────────────────────────────────────────────────────────┘
```

### Request Actions

**Projects:**

- `ListProjects` - Get all projects
- `GetProject` - Get project by ID
- `CreateProject` - Create new project
- `UpdateProject` - Update project details
- `DeleteProject` - Delete project

**Tasks:**

- `ListTasks` - Get tasks for a project
- `GetTask` - Get task by ID
- `CreateTask` - Create new task
- `UpdateTask` - Update task (status, description, etc.)
- `DeleteTask` - Delete task

**Sessions:**

- `ListSessions` - Get sessions for a task
- `GetSession` - Get session by ID
- `CreateSession` - Start new agent session
- `StopSession` - Stop running session

**Executions:**

- `ListExecutions` - Get execution processes for session
- `GetExecution` - Get execution details
- `GetExecutionLogs` - Get logs for execution

## Key Components

### 1. WorktreeManager

Manages git worktree operations.

```typescript
class WorktreeManager {
  async createWorktree(
    projectPath: string,
    taskId: string,
    branchName: string,
  ): Promise<string>;

  async removeWorktree(worktreePath: string): Promise<void>;

  async listWorktrees(projectPath: string): Promise<Worktree[]>;
}
```

### 2. SessionManager

Manages session lifecycle with worktree support.

```typescript
class SessionManager {
  async createWorktreeSession(
    taskId: string,
    projectPath: string,
    branchName?: string,
  ): Promise<Session>;

  async startAgent(
    sessionId: string,
    agentConfig: AgentConfig,
  ): Promise<ExecutionProcess>;

  async stopSession(sessionId: string): Promise<void>;
}
```

### 3. AgentProcessManager

Spawns and monitors agent processes using the Rust `agent-client-protocol`. This manager interfaces with the cargo-based agent client to execute agent behaviors in the isolated worktrees.

```typescript
class AgentProcessManager {
  // Spawns a new agent process using the rust agent-client-protocol
  async spawn(config: ProcessConfig): Promise<string>;

  async kill(processId: string): Promise<void>;

  async getOutput(processId: string): Promise<string[]>;
}
```
