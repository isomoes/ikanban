# iKanban - Multi-Agent Manager

A Rust-based multi-agent task management system with a core server and multiple client support via HTTP/WebSocket.

## Architecture

```
+------------------+     +------------------+     +------------------+
|   TUI Client     |     |   Web Client     |     |  Other Clients   |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         |    HTTP/WebSocket      |    HTTP/WebSocket      |
         +------------------------+------------------------+
                                  |
                    +-------------+-------------+
                    |      iKanban Core         |
                    |   (HTTP + WebSocket API)  |
                    +-------------+-------------+
                                  |
                    +-------------+-------------+
                    |     SQLite Database       |
                    +---------------------------+
```

## Data Model Hierarchy

```
Project (1:1 with Repo)
    │
    ├── repo_path, branch, working_dir
    │
    └── Tasks (1:N)
            │
            └── Sessions (1:N per Task, each run is a session)
                    │
                    └── ExecutionProcess (1:N per Session)
```

- **Project**: One project = one repository. Contains repo path, branch, working directory.
- **Task**: A unit of work within a project. Can have multiple sessions (attempts/runs).
- **Session**: One execution attempt of a task. Each time you run a task, a new session is created.
- **ExecutionProcess**: The actual process running within a session (agent, script, etc.).

## MVP Core API Specification

### Health Check

- `GET /health` - Server health status

### Projects API

| Method | Endpoint                  | Description                          |
| ------ | ------------------------- | ------------------------------------ |
| GET    | `/api/projects`           | List all projects                    |
| POST   | `/api/projects`           | Create a new project                 |
| GET    | `/api/projects/{id}`      | Get project by ID                    |
| PUT    | `/api/projects/{id}`      | Update project                       |
| DELETE | `/api/projects/{id}`      | Delete project                       |
| GET    | `/api/projects/stream/ws` | WebSocket stream for project updates |

### Tasks API

| Method | Endpoint                               | Description                       |
| ------ | -------------------------------------- | --------------------------------- |
| GET    | `/api/tasks?project_id={id}`           | List tasks for a project          |
| POST   | `/api/tasks`                           | Create a new task                 |
| GET    | `/api/tasks/{id}`                      | Get task by ID                    |
| PUT    | `/api/tasks/{id}`                      | Update task                       |
| DELETE | `/api/tasks/{id}`                      | Delete task                       |
| GET    | `/api/tasks/stream/ws?project_id={id}` | WebSocket stream for task updates |

### Sessions API (Planned)

| Method | Endpoint                                    | Description                |
| ------ | ------------------------------------------- | -------------------------- |
| GET    | `/api/tasks/{tid}/sessions`                 | List sessions for a task   |
| POST   | `/api/tasks/{tid}/sessions`                 | Create a new session (run) |
| GET    | `/api/tasks/{tid}/sessions/{sid}`           | Get session by ID          |

### Execution API (Planned)

| Method | Endpoint                                          | Description                    |
| ------ | ------------------------------------------------- | ------------------------------ |
| GET    | `.../sessions/{sid}/executions`                   | List executions for session    |
| POST   | `.../sessions/{sid}/executions`                   | Start execution process        |
| GET    | `.../sessions/{sid}/executions/{eid}`             | Get execution by ID            |
| POST   | `.../sessions/{sid}/executions/{eid}/stop`        | Stop/kill execution            |
| GET    | `.../sessions/{sid}/executions/{eid}/logs`        | Get execution logs             |
| GET    | `.../sessions/{sid}/executions/{eid}/logs/stream` | Stream execution logs (WS/SSE) |
| POST   | `.../sessions/{sid}/restore/{eid}`                | Restore to execution state     |

### Merge API (Planned)

| Method | Endpoint                             | Description             |
| ------ | ------------------------------------ | ----------------------- |
| GET    | `/api/projects/{pid}/merges`         | List merges for project |
| POST   | `/api/projects/{pid}/merges/direct`  | Create direct merge     |
| POST   | `/api/projects/{pid}/merges/pr`      | Create PR               |
| GET    | `/api/projects/{pid}/merges/{mid}`   | Get merge by ID         |

### Events API (SSE)

| Method | Endpoint      | Description                               |
| ------ | ------------- | ----------------------------------------- |
| GET    | `/api/events` | Server-Sent Events stream for all updates |

---

## Implementation TODO

### Phase 1: Project Setup (Completed)

- [x] Create TODO.md with API specifications
- [x] Initialize Rust workspace with Cargo.toml
- [x] Create crate structure:
  - `ikanban-core` - Core server with HTTP/WebSocket API
  - `ikanban-tui` - Terminal UI client

### Phase 2: Core Server MVP (Completed)

- [x] Setup dependencies (axum, tokio, sqlx, serde, uuid)
- [x] Database layer
  - [x] SQLite connection pool
  - [x] Project model & migrations
  - [x] Task model & migrations
- [x] HTTP API routes
  - [x] Health check endpoint
  - [x] Projects CRUD endpoints
  - [x] Tasks CRUD endpoints
- [x] WebSocket support
  - [x] Project stream endpoint
  - [x] Task stream endpoint
- [x] Event broadcasting system
  - [x] In-memory event bus
  - [x] SSE endpoint for events

### Phase 3: TUI Client MVP (Completed)

- [x] Setup dependencies (ratatui, crossterm, reqwest, tokio-tungstenite)
- [x] HTTP client for REST API
- [ ] WebSocket client for real-time updates (prepared, not yet integrated)
- [x] TUI components
  - [x] Project list view
  - [x] Task board view (kanban style)
  - [ ] Task detail/edit view
- [x] Keyboard navigation

### Phase 4: Enhanced Data Models

- [ ] Extended Project model (1:1 with repo)
  - [ ] Add `repo_path` field (repository path)
  - [ ] Add `branch` field
  - [ ] Add `working_dir` field
  - [ ] Add `archived/pinned` flags
  - [ ] Add `find_most_active()` query for project sorting
  - [ ] `ProjectWithStatus` view with is_running/is_errored
- [ ] Extended Task model
  - [ ] Add `InReview` and `Cancelled` status variants
  - [ ] Add `parent_task_id` field for task hierarchy
  - [ ] Implement `TaskWithSessionStatus` view struct

### Phase 5: Session Management

- [ ] Session entity
  - [ ] Create `sessions` table migration
  - [ ] Fields: task_id, executor (profile)
  - [ ] Find sessions by task, ordered by last used
  - [ ] Each session = one run/attempt of a task

### Phase 6: Execution Process System

- [ ] ExecutionProcess entity
  - [ ] Create `execution_processes` table migration
  - [ ] Run reasons: SetupScript, CleanupScript, CodingAgent, DevServer
  - [ ] Status: Running, Completed, Failed, Killed
  - [ ] executor_action JSON storage
  - [ ] dropped flag for soft-delete/restore
  - [ ] started_at, completed_at timestamps
- [ ] ExecutionProcessLogs
  - [ ] Streaming log storage
  - [ ] Log retrieval for UI display
- [ ] ExecutionProcessRepoState
  - [ ] Track before/after head commits
- [ ] CodingAgentTurn entity
  - [ ] Track agent session interactions
  - [ ] prompt and summary storage
  - [ ] seen flag for notification badges
  - [ ] agent_session_id for Claude/Amp integration

### Phase 7: Additional Features

- [ ] Tag/Template system
  - [ ] Create `tags` table migration
  - [ ] CRUD for task templates
  - [ ] Tag content storage
- [ ] Image attachments
  - [ ] Create `images` and `task_images` tables
  - [ ] Image upload/storage with hash deduplication
  - [ ] Task-image associations
  - [ ] Orphaned image cleanup
- [ ] Merge tracking
  - [ ] Create `merges` table migration
  - [ ] Direct merge support
  - [ ] PR merge with status monitoring
  - [ ] PR status polling service
- [ ] Scratch/Draft entity
  - [ ] Temporary storage for work in progress

### Phase 8: API Extensions

- [ ] Extended Project API endpoints
  - [ ] Project context loading (with tasks, sessions)
  - [ ] Archive/unarchive, pin/unpin
- [ ] Session API endpoints
  - [ ] Create session for task
  - [ ] List sessions by task
- [ ] Execution API endpoints
  - [ ] Start execution process
  - [ ] Stream execution logs
  - [ ] Stop/kill execution
  - [ ] Restore to previous state (drop processes)
- [ ] Merge API endpoints
  - [ ] Create PR / direct merge
  - [ ] Get merge status
  - [ ] List merges by project

### Phase 9: Real-time Features

- [ ] Enhanced WebSocket events
  - [ ] Project events (created, updated, archived)
  - [ ] Session events
  - [ ] Execution process events (started, completed, failed)
  - [ ] Log streaming via WebSocket
- [ ] PR monitoring service
  - [ ] Background polling for PR status
  - [ ] Auto-archive on merge
  - [ ] Notification on status change

### Phase 10: TUI Enhancements

- [ ] Task detail/edit view
- [ ] Project detail view (with branch, status)
- [ ] Session list view (task run history)
- [ ] Execution log viewer
- [ ] Real-time status indicators
- [ ] Keyboard shortcuts for common actions

### Phase 11: Polish & Testing

- [ ] Error handling improvements
- [x] Logging with tracing
- [ ] Integration tests
- [ ] API documentation
- [ ] Graceful shutdown handling
- [ ] File search cache (for large repos)
- [ ] Analytics/telemetry (optional)

---

## Data Models

### Project (1:1 with Repo)

```rust
pub struct Project {
    pub id: Uuid,
    pub name: String,
    // Repo info (one project = one repo)
    pub repo_path: String,              // Repository path
    pub branch: Option<String>,         // Current branch
    pub working_dir: Option<String>,    // Working directory within repo
    // Status
    pub archived: bool,
    pub pinned: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct ProjectWithStatus {
    pub project: Project,
    pub is_running: bool,      // Has running session
    pub is_errored: bool,      // Last session failed
    pub task_count: i32,
    pub active_task_count: i32,
}

pub struct CreateProject {
    pub name: String,
    pub repo_path: String,
    pub branch: Option<String>,
    pub working_dir: Option<String>,
}

pub struct UpdateProject {
    pub name: Option<String>,
    pub branch: Option<String>,
    pub working_dir: Option<String>,
    pub archived: Option<bool>,
    pub pinned: Option<bool>,
}
```

### Task

```rust
pub enum TaskStatus {
    Todo,
    InProgress,
    InReview,
    Done,
    Cancelled,
}

pub struct Task {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub parent_task_id: Option<Uuid>,   // For subtasks
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct TaskWithSessionStatus {
    pub task: Task,
    pub session_count: i32,         // Total runs
    pub has_running_session: bool,  // Currently running
    pub last_session_failed: bool,  // Last run failed
}

pub struct CreateTask {
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub parent_task_id: Option<Uuid>,
}

pub struct UpdateTask {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub parent_task_id: Option<Uuid>,
}
```

### Session (one run/attempt of a Task)

```rust
pub struct Session {
    pub id: Uuid,
    pub task_id: Uuid,              // Belongs to task
    pub executor: Option<String>,   // Executor profile name
    pub status: SessionStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub enum SessionStatus {
    Running,
    Completed,
    Failed,
    Cancelled,
}

pub struct CreateSession {
    pub executor: Option<String>,
}
```

### ExecutionProcess

```rust
pub enum ExecutionProcessStatus {
    Running,
    Completed,
    Failed,
    Killed,
}

pub enum ExecutionProcessRunReason {
    SetupScript,
    CleanupScript,
    CodingAgent,
    DevServer,
}

pub struct ExecutionProcess {
    pub id: Uuid,
    pub session_id: Uuid,
    pub run_reason: ExecutionProcessRunReason,
    pub executor_action: Json<ExecutorAction>,
    pub status: ExecutionProcessStatus,
    pub exit_code: Option<i64>,
    pub dropped: bool,  // For soft-delete/restore
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### CodingAgentTurn

```rust
pub struct CodingAgentTurn {
    pub id: Uuid,
    pub execution_process_id: Uuid,
    pub agent_session_id: Option<String>,
    pub prompt: Option<String>,
    pub summary: Option<String>,
    pub seen: bool,  // For notification badges
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Merge

```rust
pub enum MergeStatus {
    Open,
    Merged,
    Closed,
    Unknown,
}

pub enum Merge {
    Direct(DirectMerge),
    Pr(PrMerge),
}

pub struct DirectMerge {
    pub id: Uuid,
    pub project_id: Uuid,
    pub merge_commit: String,
    pub target_branch: String,
    pub created_at: DateTime<Utc>,
}

pub struct PrMerge {
    pub id: Uuid,
    pub project_id: Uuid,
    pub target_branch: String,
    pub pr_number: i64,
    pub pr_url: String,
    pub status: MergeStatus,
    pub merged_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
```

---

## API Response Format

All API responses follow this structure:

```rust
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}
```

---

## WebSocket Message Format

```rust
pub enum WsMessage {
    // Project events
    ProjectCreated(Project),
    ProjectUpdated(Project),
    ProjectDeleted { id: Uuid },

    // Task events
    TaskCreated(Task),
    TaskUpdated(Task),
    TaskDeleted { id: Uuid },

    // Session events (task runs)
    SessionCreated(Session),
    SessionUpdated(Session),
    SessionCompleted { id: Uuid, status: SessionStatus },

    // Execution events
    ExecutionStarted(ExecutionProcess),
    ExecutionCompleted(ExecutionProcess),
    ExecutionFailed(ExecutionProcess),
    ExecutionLog { process_id: Uuid, data: String },

    // Merge events
    MergeCreated(Merge),
    MergeStatusUpdated { id: Uuid, status: MergeStatus },
}
```

---

## Tech Stack

### Core Server

- **axum** - Web framework with WebSocket support
- **tokio** - Async runtime
- **sqlx** - Async SQL with SQLite
- **serde** - Serialization
- **uuid** - UUID generation
- **chrono** - Date/time handling
- **tracing** - Logging

### TUI Client

- **ratatui** - Terminal UI framework
- **crossterm** - Terminal manipulation
- **reqwest** - HTTP client
- **tokio-tungstenite** - WebSocket client
- **tokio** - Async runtime
