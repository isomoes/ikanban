# AGENTS.md

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

| Library | Purpose |
|---------|---------|
| `serde` | Serialization/deserialization for server functions |
| `tower` / `tower-http` | HTTP middleware (CORS, logging, compression) |
| `tracing` | Structured logging and diagnostics |
| `thiserror` / `anyhow` | Error handling |

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
