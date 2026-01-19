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

### Events API (SSE)

| Method | Endpoint      | Description                               |
| ------ | ------------- | ----------------------------------------- |
| GET    | `/api/events` | Server-Sent Events stream for all updates |

---

## Implementation TODO

### Phase 1: Project Setup

- [x] Create TODO.md with API specifications
- [x] Initialize Rust workspace with Cargo.toml
- [x] Create crate structure:
  - `ikanban-core` - Core server with HTTP/WebSocket API
  - `ikanban-tui` - Terminal UI client

### Phase 2: Core Server (ikanban-core)

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

### Phase 3: TUI Client (ikanban-tui)

- [x] Setup dependencies (ratatui, crossterm, reqwest, tokio-tungstenite)
- [x] HTTP client for REST API
- [ ] WebSocket client for real-time updates (prepared, not yet integrated)
- [x] TUI components
  - [x] Project list view
  - [x] Task board view (kanban style)
  - [ ] Task detail/edit view
- [x] Keyboard navigation

### Phase 4: Polish & Testing

- [ ] Error handling improvements
- [x] Logging with tracing
- [ ] Integration tests
- [ ] Documentation

---

## Data Models

### Project

```rust
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct CreateProject {
    pub name: String,
    pub description: Option<String>,
}

pub struct UpdateProject {
    pub name: Option<String>,
    pub description: Option<String>,
}
```

### Task

```rust
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
}

pub struct Task {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub struct CreateTask {
    pub project_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
}

pub struct UpdateTask {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<TaskStatus>,
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
