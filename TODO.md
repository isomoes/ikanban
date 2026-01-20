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

### Workspaces API (Planned)

| Method | Endpoint                                                   | Description                     |
| ------ | ---------------------------------------------------------- | ------------------------------- |
| GET    | `/api/projects/{pid}/tasks/{tid}/workspaces`               | List workspaces for a task      |
| POST   | `/api/projects/{pid}/tasks/{tid}/workspaces`               | Create a new workspace          |
| GET    | `/api/projects/{pid}/tasks/{tid}/workspaces/{wid}`         | Get workspace by ID             |
| PATCH  | `/api/projects/{pid}/tasks/{tid}/workspaces/{wid}`         | Update workspace                |
| DELETE | `/api/projects/{pid}/tasks/{tid}/workspaces/{wid}`         | Delete workspace                |
| POST   | `/api/projects/{pid}/tasks/{tid}/workspaces/{wid}/archive` | Archive/unarchive workspace     |
| GET    | `/api/workspaces`                                          | List all workspaces (global)    |
| GET    | `/api/workspaces/{wid}/context`                            | Get workspace with full context |

### Sessions API (Planned)

| Method | Endpoint                                                          | Description                 |
| ------ | ----------------------------------------------------------------- | --------------------------- |
| GET    | `/api/projects/{pid}/tasks/{tid}/workspaces/{wid}/sessions`       | List sessions for workspace |
| POST   | `/api/projects/{pid}/tasks/{tid}/workspaces/{wid}/sessions`       | Create a new session        |
| GET    | `/api/projects/{pid}/tasks/{tid}/workspaces/{wid}/sessions/{sid}` | Get session by ID           |

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

### Repos API (Planned)

| Method | Endpoint                          | Description               |
| ------ | --------------------------------- | ------------------------- |
| GET    | `/api/repos`                      | List all repos            |
| GET    | `/api/repos/{id}`                 | Get repo by ID            |
| PATCH  | `/api/repos/{id}`                 | Update repo configuration |
| GET    | `/api/projects/{pid}/repos`       | List repos for project    |
| POST   | `/api/projects/{pid}/repos`       | Add repo to project       |
| DELETE | `/api/projects/{pid}/repos/{rid}` | Remove repo from project  |

### Merge API (Planned)

| Method | Endpoint                             | Description               |
| ------ | ------------------------------------ | ------------------------- |
| GET    | `.../workspaces/{wid}/merges`        | List merges for workspace |
| POST   | `.../workspaces/{wid}/merges/direct` | Create direct merge       |
| POST   | `.../workspaces/{wid}/merges/pr`     | Create PR                 |
| GET    | `.../workspaces/{wid}/merges/{mid}`  | Get merge by ID           |

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

### Phase 4: Enhanced Data Models (Based on Reference)

- [ ] Extended Task model
  - [ ] Add `InReview` and `Cancelled` status variants
  - [ ] Add `parent_workspace_id` field for task hierarchy
  - [ ] Add `shared_task_id` for cross-project task sharing
  - [ ] Implement `TaskWithAttemptStatus` view struct
  - [ ] Add `TaskRelationships` for parent/child navigation
- [ ] Extended Project model
  - [ ] Add `default_agent_working_dir` field
  - [ ] Add `remote_project_id` for remote project linking
  - [ ] Add `find_most_active()` query for project sorting
- [ ] Repo entity
  - [ ] Create `repos` table migration
  - [ ] Model with path, name, display_name
  - [ ] Configuration: setup_script, cleanup_script, copy_files
  - [ ] dev_server_script support
  - [ ] parallel_setup_script flag
  - [ ] find_or_create() for upsert pattern
- [ ] ProjectRepo junction table
  - [ ] Link projects to multiple repositories
  - [ ] Default branch configuration per project-repo

### Phase 5: Workspace & Session Management

- [ ] Workspace entity
  - [ ] Create `workspaces` table migration
  - [ ] Fields: task_id, container_ref, branch, agent_working_dir
  - [ ] setup_completed_at timestamp
  - [ ] archived/pinned flags
  - [ ] Auto-generated name from first prompt
  - [ ] `WorkspaceWithStatus` view with is_running/is_errored
  - [ ] Container cleanup for expired workspaces
  - [ ] Branch name updates
- [ ] WorkspaceRepo junction
  - [ ] Link workspaces to repos
  - [ ] target_branch per workspace-repo
- [ ] Session entity
  - [ ] Create `sessions` table migration
  - [ ] Fields: workspace_id, executor (profile)
  - [ ] Find sessions by workspace, ordered by last used

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
  - [ ] Track before/after head commits per repo
  - [ ] Support for multi-repo workspaces
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

- [ ] Workspace API endpoints
  - [ ] CRUD for workspaces
  - [ ] Workspace context loading (with task, project, repos)
  - [ ] Archive/unarchive, pin/unpin
- [ ] Session API endpoints
  - [ ] Create session for workspace
  - [ ] List sessions by workspace
- [ ] Execution API endpoints
  - [ ] Start execution process
  - [ ] Stream execution logs
  - [ ] Stop/kill execution
  - [ ] Restore to previous state (drop processes)
- [ ] Merge API endpoints
  - [ ] Create PR / direct merge
  - [ ] Get merge status
  - [ ] List merges by workspace
- [ ] Repository API endpoints
  - [ ] CRUD for repos
  - [ ] Project-repo associations
  - [ ] Repo configuration updates

### Phase 9: Real-time Features

- [ ] Enhanced WebSocket events
  - [ ] Workspace events (created, updated, archived)
  - [ ] Session events
  - [ ] Execution process events (started, completed, failed)
  - [ ] Log streaming via WebSocket
- [ ] PR monitoring service
  - [ ] Background polling for PR status
  - [ ] Auto-archive on merge
  - [ ] Notification on status change

### Phase 10: TUI Enhancements

- [ ] Task detail/edit view
- [ ] Workspace list view
- [ ] Execution log viewer
- [ ] Real-time status indicators
- [ ] Multi-repo support in UI
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

### Project

```rust
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub default_agent_working_dir: Option<String>,
    pub remote_project_id: Option<Uuid>,  // For remote project linking
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct CreateProject {
    pub name: String,
    pub repositories: Vec<CreateProjectRepo>,
}

pub struct UpdateProject {
    pub name: Option<String>,
}
```

### Task

```rust
pub enum TaskStatus {
    Todo,
    InProgress,
    InReview,   // New: for code review stage
    Done,
    Cancelled,  // New: for cancelled tasks
}

pub struct Task {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub parent_workspace_id: Option<Uuid>,  // For task hierarchy
    pub shared_task_id: Option<Uuid>,       // For cross-project sharing
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct TaskWithAttemptStatus {
    pub task: Task,
    pub has_in_progress_attempt: bool,
    pub last_attempt_failed: bool,
    pub executor: String,
}

pub struct CreateTask {
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub parent_workspace_id: Option<Uuid>,
    pub image_ids: Option<Vec<Uuid>>,
}

pub struct UpdateTask {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
    pub parent_workspace_id: Option<Uuid>,
    pub image_ids: Option<Vec<Uuid>>,
}
```

### Workspace

```rust
pub struct Workspace {
    pub id: Uuid,
    pub task_id: Uuid,
    pub container_ref: Option<String>,     // Container/worktree path
    pub branch: String,
    pub agent_working_dir: Option<String>,
    pub setup_completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub archived: bool,
    pub pinned: bool,
    pub name: Option<String>,  // Auto-generated from first prompt
}

pub struct WorkspaceWithStatus {
    pub workspace: Workspace,
    pub is_running: bool,
    pub is_errored: bool,
}

pub struct CreateWorkspace {
    pub branch: String,
    pub agent_working_dir: Option<String>,
}
```

### Session

```rust
pub struct Session {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub executor: Option<String>,  // Executor profile name
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct CreateSession {
    pub executor: Option<String>,
}
```

### Repo

```rust
pub struct Repo {
    pub id: Uuid,
    pub path: PathBuf,
    pub name: String,
    pub display_name: String,
    pub setup_script: Option<String>,
    pub cleanup_script: Option<String>,
    pub copy_files: Option<String>,
    pub parallel_setup_script: bool,
    pub dev_server_script: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct UpdateRepo {
    pub display_name: Option<Option<String>>,
    pub setup_script: Option<Option<String>>,
    pub cleanup_script: Option<Option<String>>,
    pub copy_files: Option<Option<String>>,
    pub parallel_setup_script: Option<Option<bool>>,
    pub dev_server_script: Option<Option<String>>,
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
    pub workspace_id: Uuid,
    pub repo_id: Uuid,
    pub merge_commit: String,
    pub target_branch_name: String,
    pub created_at: DateTime<Utc>,
}

pub struct PrMerge {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub repo_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub target_branch_name: String,
    pub pr_info: PullRequestInfo,
}

pub struct PullRequestInfo {
    pub number: i64,
    pub url: String,
    pub status: MergeStatus,
    pub merged_at: Option<DateTime<Utc>>,
    pub merge_commit_sha: Option<String>,
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

    // Workspace events
    WorkspaceCreated(Workspace),
    WorkspaceUpdated(Workspace),
    WorkspaceDeleted { id: Uuid },
    WorkspaceArchived { id: Uuid, archived: bool },

    // Session events
    SessionCreated(Session),
    SessionUpdated(Session),

    // Execution events
    ExecutionProcessStarted(ExecutionProcess),
    ExecutionProcessCompleted(ExecutionProcess),
    ExecutionProcessFailed(ExecutionProcess),
    ExecutionProcessKilled(ExecutionProcess),
    ExecutionLogChunk { process_id: Uuid, data: String },

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
