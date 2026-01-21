# iKanban Implementation TODO

## Phase 1: Project Setup

- [ ] Initialize Cargo workspace with proper feature flags (hydrate, ssr)
- [ ] Configure `Cargo.toml` with all dependencies:
  - leptos, leptos_axum
  - axum, tokio, tower, tower-http
  - sqlx (sqlite, runtime-tokio)
  - serde, tracing, thiserror, anyhow
  - agent-client-protocol
- [ ] Set up cargo-leptos configuration in `Cargo.toml`
- [ ] Create project directory structure
- [ ] Set up Tailwind CSS v4 with `style/main.css`
- [ ] Configure SQLx and create initial migration

## Phase 2: Database Schema

- [ ] Create `projects` table migration
  - id, name, repo_path, description, created_at, updated_at
- [ ] Create `tasks` table migration
  - id, project_id, title, description, status (Todo/InProgress/InReview/Done), priority, created_at, updated_at
- [ ] Create `sessions` table migration
  - id, task_id, worktree_path, branch_name, status (Running/Completed/Failed), created_at, ended_at
- [ ] Create `execution_processes` table migration
  - id, session_id, run_reason, pid, status, started_at, ended_at
- [ ] Create `coding_agent_turns` table migration
  - id, execution_id, turn_number, input, output, created_at

## Phase 3: Backend - Core Server

### Database Layer (`src/server/db.rs`)

- [ ] Implement database connection pool setup
- [ ] Implement Project CRUD operations
- [ ] Implement Task CRUD operations
- [ ] Implement Session CRUD operations
- [ ] Implement ExecutionProcess CRUD operations
- [ ] Implement CodingAgentTurn operations

### Worktree Manager (`src/server/worktree.rs`)

- [ ] Implement `create_worktree(project_path, task_id, branch_name) -> worktree_path`
- [ ] Implement `remove_worktree(worktree_path)`
- [ ] Implement `list_worktrees(project_path) -> Vec<Worktree>`
- [ ] Implement branch name generation: `task/{task_id}-{slug}`
- [ ] Handle worktree path: `~/.ikanban/worktrees/task-{id}`

### Agent Process Manager (`src/server/agent.rs`)

- [ ] Implement agent process spawning with `agent-client-protocol`
- [ ] Implement stdout/stderr capture via Tokio
- [ ] Implement process lifecycle management (spawn, monitor, kill)
- [ ] Implement output streaming/buffering
- [ ] Implement turn tracking and logging

### Session Manager (integrated in `src/server/`)

- [ ] Implement `create_worktree_session(task_id, project_path, branch_name)`
- [ ] Implement `start_agent(session_id, agent_config) -> ExecutionProcess`
- [ ] Implement `stop_session(session_id)`
- [ ] Implement session status transitions

## Phase 4: API Layer (`src/api.rs`)

### Project Server Functions

- [ ] `#[server] list_projects() -> Vec<Project>`
- [ ] `#[server] get_project(id) -> Project`
- [ ] `#[server] create_project(name, repo_path, description) -> Project`
- [ ] `#[server] update_project(id, ...) -> Project`
- [ ] `#[server] delete_project(id)`

### Task Server Functions

- [ ] `#[server] list_tasks(project_id) -> Vec<Task>`
- [ ] `#[server] get_task(id) -> Task`
- [ ] `#[server] create_task(project_id, title, description) -> Task`
- [ ] `#[server] update_task(id, status, ...) -> Task`
- [ ] `#[server] delete_task(id)`

### Session Server Functions

- [ ] `#[server] list_sessions(task_id) -> Vec<Session>`
- [ ] `#[server] get_session(id) -> Session`
- [ ] `#[server] create_session(task_id) -> Session` (creates worktree)
- [ ] `#[server] stop_session(id)` (stops agent, optionally removes worktree)

### Execution Server Functions

- [ ] `#[server] list_executions(session_id) -> Vec<ExecutionProcess>`
- [ ] `#[server] get_execution(id) -> ExecutionProcess`
- [ ] `#[server] get_execution_logs(id) -> Vec<CodingAgentTurn>`

## Phase 5: Frontend - UI Components

### Root App (`src/app.rs`)

- [ ] Set up Leptos router
- [ ] Define routes: `/`, `/projects/{id}`, `/tasks/{id}`, `/sessions/{id}`
- [ ] Implement global state/context providers

### Board Component (`src/components/board.rs`)

- [ ] Implement Kanban board layout (4 columns: Todo, InProgress, InReview, Done)
- [ ] Implement drag-and-drop task movement
- [ ] Implement task filtering and sorting
- [ ] Implement column task counts

### Task Component (`src/components/task.rs`)

- [ ] Implement task card display (title, description, priority)
- [ ] Implement task status badge
- [ ] Implement "Start Task" action (creates session + worktree)
- [ ] Implement task edit modal
- [ ] Implement task delete confirmation

### Session Component (`src/components/session.rs`)

- [ ] Implement session status display
- [ ] Implement agent output viewer (real-time streaming)
- [ ] Implement turn history display
- [ ] Implement "Stop Session" action
- [ ] Implement branch/worktree info display

### Additional Components

- [ ] `src/components/project_list.rs` - Project selection/management
- [ ] `src/components/project_form.rs` - Create/edit project form
- [ ] `src/components/task_form.rs` - Create/edit task form
- [ ] `src/components/execution_log.rs` - Detailed execution log viewer
- [ ] `src/components/navbar.rs` - Navigation bar

## Phase 6: Server Entry Point (`src/main.rs`)

- [ ] Set up Axum router with Leptos integration
- [ ] Configure Tower middleware (CORS, logging, compression)
- [ ] Initialize database connection pool
- [ ] Set up tracing/logging
- [ ] Serve static files from `public/`
- [ ] Handle SSR and hydration

## Phase 7: Styling & Polish

- [ ] Design Tailwind CSS theme (colors, spacing)
- [ ] Style Kanban board columns
- [ ] Style task cards with status colors
- [ ] Style session/agent output viewer
- [ ] Add loading states and spinners
- [ ] Add error message displays
- [ ] Responsive design for different screen sizes

## Phase 8: Integration & Testing

- [ ] Integration test: Project CRUD flow
- [ ] Integration test: Task lifecycle (create → start → complete)
- [ ] Integration test: Session/worktree creation and cleanup
- [ ] Integration test: Agent process spawning and monitoring
- [ ] End-to-end test: Full task workflow with agent
- [ ] Test concurrent agents on multiple worktrees

## Phase 9: Documentation & Deployment

- [ ] Update README with setup instructions
- [ ] Document environment variables
- [ ] Document agent configuration options
- [ ] Create production build script
- [ ] Set up systemd service file (optional)
- [ ] Document backup/restore procedures for SQLite DB

---

## Priority Order

1. **Phase 1-2**: Foundation (project setup, database)
2. **Phase 3**: Backend core (db layer, worktree manager)
3. **Phase 4**: API layer (server functions)
4. **Phase 5**: Frontend components (board, task, session)
5. **Phase 6**: Server integration
6. **Phase 7-9**: Polish, testing, deployment
