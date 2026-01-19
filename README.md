# iKanban

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

## Quick Start

### Build

```bash
cargo build --release
```

### Run the Server

```bash
# Default port 3000
./target/release/ikanban-server

# Custom port
PORT=8080 ./target/release/ikanban-server

# Custom database
DATABASE_URL=sqlite:mydata.db ./target/release/ikanban-server
```

### Run the TUI Client

```bash
# Connect to default server (http://127.0.0.1:3000)
./target/release/ikanban

# Connect to custom server
IKANBAN_SERVER=http://localhost:8080 ./target/release/ikanban
```

## TUI Keyboard Shortcuts

### Projects View
- `j/k` or `Down/Up` - Navigate projects
- `Enter` - Open project (view tasks)
- `n` - Create new project
- `d` - Delete selected project
- `r` - Refresh
- `q` - Quit

### Tasks View (Kanban Board)
- `j/k` or `Down/Up` - Navigate tasks in column
- `h/l` or `Left/Right` - Switch columns
- `Space` - Move task to next status (Todo -> In Progress -> Done)
- `n` - Create new task in current column
- `d` - Delete selected task
- `r` - Refresh
- `Esc` - Back to projects
- `q` - Quit

## API Endpoints

### Health
- `GET /health` - Server health check

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/{id}` - Get project
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project
- `GET /api/projects/stream/ws` - WebSocket stream

### Tasks
- `GET /api/tasks?project_id={id}` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/{id}` - Get task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `GET /api/tasks/stream/ws?project_id={id}` - WebSocket stream

### Events
- `GET /api/events` - Server-Sent Events stream

## Project Structure

```
ikanban/
├── Cargo.toml              # Workspace configuration
├── TODO.md                 # Development roadmap
├── crates/
│   ├── ikanban-core/       # Core server
│   │   └── src/
│   │       ├── main.rs     # Server entry point
│   │       ├── lib.rs      # Library exports
│   │       ├── db.rs       # Database setup
│   │       ├── error.rs    # Error types
│   │       ├── state.rs    # App state
│   │       ├── models/     # Data models
│   │       └── routes/     # HTTP/WS routes
│   └── ikanban-tui/        # TUI client
│       └── src/
│           ├── main.rs     # TUI entry point
│           ├── lib.rs      # Library exports
│           ├── api.rs      # HTTP client
│           ├── app.rs      # App state
│           ├── models.rs   # Data models
│           └── ui.rs       # UI rendering
```

## License

MIT
