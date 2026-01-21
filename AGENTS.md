# AGENTS.md

## Rules

- Don't manually change code format. Use formatting tools.
- NOT to update/create markdown docs unless asked.
- When a TODO.md item is completed, update the TODO.md to mark it as done.
- if change the code, need use cargo check to ensure no errors.

## Architecture

```
Web Client <--WebSocket--> iKanban Core <--> SQLite
```

All communication uses WebSocket (no REST API). Single endpoint: `GET /api/ws`

## Data Model

```
Project (1:1 Repo)
  └── Tasks (1:N)
        └── Sessions (1:N, each run)
              └── ExecutionProcess (1:N)
```

## WebSocket Protocol

### Connection

- Endpoint: `ws://server/api/ws`
- All operations use request/response pattern over single WebSocket connection
- Events are broadcast to subscribed clients

### Message Types

**Request** (client → server):

```json
{ "type": "Request", "payload": { "id": "uuid", "action": "ListProjects" } }
```

**Response** (server → client):

```json
{"type": "Response", "payload": {"id": "uuid", "status": "Success", "data": {...}}}
```

**Event** (server → client, broadcast):

```json
{"type": "Event", "payload": {"event": "ProjectCreated", "payload": {...}}}
```
