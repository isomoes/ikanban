# Pi Agent Web Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a host-only web application that runs one persistent Pi coding-agent session against the startup working directory and streams its activity to a browser.

**Architecture:** A Node.js process owns the only mutable `AgentSessionRuntime`, exposes a small Fastify HTTP/WebSocket API, and serves a React/Vite SPA. A shared Zod package defines the complete wire protocol; Pi JSONL sessions, credentials, resources, and settings remain owned by Pi rather than being duplicated in an application database.

**Tech Stack:** Node.js 24 LTS, TypeScript 5.9, pnpm 11, Fastify 5, `@fastify/websocket` 11, `@earendil-works/pi-coding-agent` 0.83, React 19, Vite 8, Zod 4, Vitest, Testing Library, Playwright, and Pino.

## Global Constraints

- Require Node.js `>=24.12.0` and pnpm `>=11.18.0`.
- Bind the production server only to `127.0.0.1`; remote and LAN access are out of scope.
- Keep exactly one `AgentSessionRuntime` and at most one active Pi run in v1.
- Use `AgentSessionRuntime` for session replacement and re-subscribe after every replacement.
- Persist conversations with Pi `SessionManager`; do not add SQLite or another application database.
- Keep provider credentials in Pi `ModelRuntime`; never return API keys or process environment values to the browser.
- Accept commands only through the versioned shared protocol and validate every untrusted payload with Zod.
- Attach WebSocket listeners synchronously before any asynchronous work.
- Browser disconnection must not abort an active Pi run.
- Use TDD for behavior, keep files focused, and commit after every task.
- Defer project switching, multiple simultaneous sessions, child-agent orchestration, terminals, git review, extension management, and remote access.

---

## File Map

### Workspace

- `package.json`: root engines and orchestration scripts.
- `pnpm-workspace.yaml`: workspace package discovery.
- `tsconfig.base.json`: strict shared TypeScript options.
- `.gitignore`: generated files, local runtime data, and browser artifacts.

### Shared Protocol

- `packages/protocol/package.json`: dependency and package exports.
- `packages/protocol/tsconfig.json`: package compilation settings.
- `packages/protocol/src/index.ts`: protocol version, command/event schemas, and inferred types.
- `packages/protocol/src/index.test.ts`: accepted and rejected wire payloads.

### Server

- `apps/server/package.json`: server dependencies and scripts.
- `apps/server/tsconfig.json`: Node TypeScript settings.
- `apps/server/src/agent/types.ts`: narrow Pi runtime interfaces used by the controller and fakes.
- `apps/server/src/agent/transcript.ts`: conversion of Pi messages and events into protocol records.
- `apps/server/src/agent/controller.ts`: serialized command handling, snapshots, event sequence, and runtime replacement.
- `apps/server/src/agent/pi-runtime.ts`: real Pi SDK runtime factory and lifecycle adapter.
- `apps/server/src/agent/controller.test.ts`: controller tests using a deterministic fake session.
- `apps/server/src/auth.ts`: startup-token exchange and loopback/origin guards.
- `apps/server/src/app.ts`: Fastify construction, HTTP routes, WebSocket clients, and static production assets.
- `apps/server/src/app.test.ts`: HTTP authentication and WebSocket protocol tests.
- `apps/server/src/index.ts`: startup, printed browser URL, signal handling, and graceful shutdown.

### Web

- `apps/web/package.json`: React/Vite dependencies and scripts.
- `apps/web/tsconfig.json`: browser TypeScript settings.
- `apps/web/vite.config.ts`: development proxy and production output.
- `apps/web/index.html`: SPA entry document.
- `apps/web/src/main.tsx`: React bootstrap.
- `apps/web/src/styles.css`: responsive local-agent visual system.
- `apps/web/src/agent/reducer.ts`: deterministic snapshot/event projection.
- `apps/web/src/agent/reducer.test.ts`: ordered event and snapshot behavior.
- `apps/web/src/agent/use-agent-connection.ts`: token exchange, WebSocket lifecycle, and command acknowledgements.
- `apps/web/src/app.tsx`: status header, transcript, tool activity, composer, queue choice, and stop action.
- `apps/web/src/app.test.tsx`: user-visible idle, streaming, submit, and abort behavior.

### Product Verification

- `playwright.config.ts`: starts the real local server with a fake Pi adapter for browser tests.
- `tests/e2e/local-agent.spec.ts`: authenticated browser connection and streamed response test.
- `README.md`: prerequisites, local development, production startup, persistence, credentials, security boundary, and limitations.

---

### Task 1: Workspace and Versioned Protocol

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/index.ts`
- Test: `packages/protocol/src/index.test.ts`

**Interfaces:**
- Consumes: No application interfaces.
- Produces: `PROTOCOL_VERSION`, `ClientCommandSchema`, `ServerMessageSchema`, `ClientCommand`, `ServerMessage`, `RuntimeSnapshot`, `TranscriptItem`, and `AgentEvent` from `@pi-web/protocol`.

- [ ] **Step 1: Create the workspace manifests and strict TypeScript base**

```json
// package.json
{
  "name": "pi-agent-web",
  "private": true,
  "packageManager": "pnpm@11.18.0",
  "engines": { "node": ">=24.12.0" },
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --parallel --filter @pi-web/server --filter @pi-web/web dev",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - apps/*
  - packages/*
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2024",
    "lib": ["ES2024"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

```gitignore
node_modules/
dist/
coverage/
playwright-report/
test-results/
.pi-web/
*.log
```

- [ ] **Step 2: Create the protocol package manifest**

```json
// packages/protocol/package.json
{
  "name": "@pi-web/protocol",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "zod": "^4.1.5" },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

```json
// packages/protocol/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Write failing protocol validation tests**

```ts
// packages/protocol/src/index.test.ts
import { describe, expect, it } from "vitest";
import { ClientCommandSchema, ServerMessageSchema } from "./index.js";

describe("ClientCommandSchema", () => {
  it("accepts a versioned prompt command", () => {
    expect(ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "cmd-1",
      type: "prompt.send",
      text: "List files",
    })).toMatchObject({ type: "prompt.send", text: "List files" });
  });

  it("rejects unknown commands and blank prompts", () => {
    expect(() => ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "cmd-2",
      type: "prompt.send",
      text: "  ",
    })).toThrow();
    expect(() => ClientCommandSchema.parse({
      protocolVersion: 1,
      commandId: "cmd-3",
      type: "shell.execute",
    })).toThrow();
  });
});

describe("ServerMessageSchema", () => {
  it("accepts a complete runtime snapshot", () => {
    expect(ServerMessageSchema.parse({
      protocolVersion: 1,
      sequence: 0,
      type: "state.snapshot",
      snapshot: {
        workspace: "/work/project",
        sessionId: "session-1",
        status: "idle",
        items: [],
      },
    }).type).toBe("state.snapshot");
  });
});
```

- [ ] **Step 4: Run the protocol test to verify it fails**

Run: `corepack pnpm install && corepack pnpm --filter @pi-web/protocol test`

Expected: FAIL because `packages/protocol/src/index.ts` does not exist.

- [ ] **Step 5: Implement the complete wire protocol**

```ts
// packages/protocol/src/index.ts
import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

const commandBase = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  commandId: z.string().min(1),
};

export const ClientCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...commandBase, type: z.literal("session.new") }),
  z.object({ ...commandBase, type: z.literal("prompt.send"), text: z.string().trim().min(1) }),
  z.object({ ...commandBase, type: z.literal("prompt.steer"), text: z.string().trim().min(1) }),
  z.object({ ...commandBase, type: z.literal("prompt.followUp"), text: z.string().trim().min(1) }),
  z.object({ ...commandBase, type: z.literal("run.abort") }),
]);

export const TranscriptItemSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("message"), role: z.enum(["user", "assistant"]), text: z.string() }),
  z.object({ id: z.string(), type: z.literal("tool"), toolName: z.string(), status: z.enum(["running", "succeeded", "failed"]), output: z.string() }),
  z.object({ id: z.string(), type: z.literal("error"), message: z.string() }),
]);

export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run.started") }),
  z.object({ type: z.literal("run.finished") }),
  z.object({ type: z.literal("text.delta"), itemId: z.string(), delta: z.string() }),
  z.object({ type: z.literal("tool.started"), itemId: z.string(), toolName: z.string() }),
  z.object({ type: z.literal("tool.updated"), itemId: z.string(), output: z.string() }),
  z.object({ type: z.literal("tool.finished"), itemId: z.string(), output: z.string(), isError: z.boolean() }),
  z.object({ type: z.literal("agent.error"), message: z.string() }),
]);

export const RuntimeSnapshotSchema = z.object({
  workspace: z.string(),
  sessionId: z.string(),
  status: z.enum(["idle", "running", "replacing", "error"]),
  model: z.string().optional(),
  items: z.array(TranscriptItemSchema),
});

const serverBase = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  sequence: z.number().int().nonnegative(),
};

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...serverBase, type: z.literal("state.snapshot"), snapshot: RuntimeSnapshotSchema }),
  z.object({ ...serverBase, type: z.literal("agent.event"), sessionId: z.string(), event: AgentEventSchema }),
  z.object({ ...serverBase, type: z.literal("command.accepted"), commandId: z.string() }),
  z.object({ ...serverBase, type: z.literal("command.rejected"), commandId: z.string(), reason: z.string() }),
]);

export type ClientCommand = z.infer<typeof ClientCommandSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type RuntimeSnapshot = z.infer<typeof RuntimeSnapshotSchema>;
export type TranscriptItem = z.infer<typeof TranscriptItemSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
```

- [ ] **Step 6: Verify the protocol package**

Run: `corepack pnpm --filter @pi-web/protocol test && corepack pnpm --filter @pi-web/protocol typecheck`

Expected: protocol tests PASS and TypeScript exits with code 0.

- [ ] **Step 7: Commit the workspace and protocol**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .gitignore packages/protocol
git commit -m "feat: define local agent protocol"
```

---

### Task 2: Serialized Pi Runtime Controller

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/src/agent/types.ts`
- Create: `apps/server/src/agent/transcript.ts`
- Create: `apps/server/src/agent/controller.ts`
- Create: `apps/server/src/agent/pi-runtime.ts`
- Test: `apps/server/src/agent/controller.test.ts`

**Interfaces:**
- Consumes: `ClientCommand`, `ServerMessage`, `RuntimeSnapshot`, `AgentEvent`, and `TranscriptItem` from `@pi-web/protocol`.
- Produces: `AgentController.create(options)`, `controller.handle(command)`, `controller.subscribe(listener)`, `controller.snapshot()`, and `controller.dispose()`.

- [ ] **Step 1: Create the server package**

```json
// apps/server/package.json
{
  "name": "@pi-web/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@earendil-works/pi-coding-agent": "0.83.0",
    "@fastify/cookie": "^11.0.2",
    "@fastify/static": "^8.2.0",
    "@fastify/websocket": "11.3.0",
    "@pi-web/protocol": "workspace:*",
    "fastify": "5.11.0",
    "zod": "^4.1.5"
  },
  "devDependencies": {
    "@types/node": "^24.3.0",
    "tsx": "^4.20.5",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

```json
// apps/server/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Define the narrow runtime boundary**

```ts
// apps/server/src/agent/types.ts
export type PiEvent = Readonly<Record<string, unknown> & { type: string }>;

export interface PiSessionPort {
  readonly sessionId: string;
  readonly isStreaming: boolean;
  readonly messages: readonly unknown[];
  readonly model?: { provider: string; id: string };
  prompt(text: string): Promise<void>;
  steer(text: string): Promise<void>;
  followUp(text: string): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: PiEvent) => void): () => void;
}

export interface PiRuntimePort {
  readonly session: PiSessionPort;
  newSession(): Promise<void>;
  dispose(): void;
}

export type PiRuntimeFactory = (workspace: string) => Promise<PiRuntimePort>;
```

- [ ] **Step 3: Write failing controller tests with a fake runtime**

```ts
// apps/server/src/agent/controller.test.ts
import { describe, expect, it, vi } from "vitest";
import { AgentController } from "./controller.js";
import type { PiEvent, PiRuntimePort, PiSessionPort } from "./types.js";

class FakeSession implements PiSessionPort {
  sessionId = "session-1";
  isStreaming = false;
  messages: readonly unknown[] = [];
  model = { provider: "test", id: "small" };
  listener?: (event: PiEvent) => void;
  prompt = vi.fn(async (text: string) => {
    this.isStreaming = true;
    this.listener?.({ type: "agent_start" });
    this.listener?.({ type: "message_update", assistantMessageEvent: { type: "text_delta", delta: `Echo: ${text}` } });
    this.isStreaming = false;
    this.listener?.({ type: "agent_end" });
  });
  steer = vi.fn(async () => undefined);
  followUp = vi.fn(async () => undefined);
  abort = vi.fn(async () => undefined);
  subscribe(listener: (event: PiEvent) => void) { this.listener = listener; return () => { this.listener = undefined; }; }
}

describe("AgentController", () => {
  it("accepts one prompt and emits ordered normalized events", async () => {
    const session = new FakeSession();
    const runtime: PiRuntimePort = { session, newSession: vi.fn(), dispose: vi.fn() };
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    const messages: Array<{ sequence: number; type: string }> = [];
    controller.subscribe((message) => messages.push(message));

    await controller.handle({ protocolVersion: 1, commandId: "one", type: "prompt.send", text: "hello" });

    expect(session.prompt).toHaveBeenCalledWith("hello");
    expect(messages.map(({ sequence, type }) => [sequence, type])).toEqual([
      [1, "command.accepted"],
      [2, "agent.event"],
      [3, "agent.event"],
      [4, "agent.event"],
    ]);
  });

  it("rejects a normal prompt while a run is active", async () => {
    const session = new FakeSession();
    session.isStreaming = true;
    const runtime: PiRuntimePort = { session, newSession: vi.fn(), dispose: vi.fn() };
    const controller = await AgentController.create({ workspace: "/work", runtimeFactory: async () => runtime });
    const messages: Array<{ type: string; reason?: string }> = [];
    controller.subscribe((message) => messages.push(message));

    await controller.handle({ protocolVersion: 1, commandId: "two", type: "prompt.send", text: "hello" });

    expect(session.prompt).not.toHaveBeenCalled();
    expect(messages.at(-1)).toMatchObject({ type: "command.rejected", reason: "A run is already active; steer, follow up, or abort it." });
  });
});
```

- [ ] **Step 4: Run the controller tests to verify they fail**

Run: `corepack pnpm install && corepack pnpm --filter @pi-web/server test -- controller.test.ts`

Expected: FAIL because `AgentController` does not exist.

- [ ] **Step 5: Implement transcript and event normalization**

Implement `apps/server/src/agent/transcript.ts` with these exported signatures:

```ts
import type { AgentEvent, TranscriptItem } from "@pi-web/protocol";
import type { PiEvent } from "./types.js";

export function transcriptFromMessages(messages: readonly unknown[]): TranscriptItem[];
export function normalizePiEvent(event: PiEvent, nextId: () => string): AgentEvent | undefined;
```

The complete mapping must be:

```text
agent_start -> run.started
agent_end -> run.finished
message_update + text_delta -> text.delta
tool_execution_start -> tool.started
tool_execution_update -> tool.updated with stringified content
tool_execution_end -> tool.finished with isError
message_end carrying an assistant error -> agent.error
all other events -> no protocol event
```

For persisted messages, emit only user/assistant textual content. Ignore thinking blocks and tool-result structures because tool history is reconstructed from live tool events in v1. Extract text from either a string `content` or `{ type: "text", text: string }[]`; generate stable IDs from the source message ID when present and otherwise `history-<index>`.

- [ ] **Step 6: Implement the serialized controller**

Implement `apps/server/src/agent/controller.ts` with this public API:

```ts
export interface AgentControllerOptions {
  workspace: string;
  runtimeFactory: PiRuntimeFactory;
}

export class AgentController {
  static create(options: AgentControllerOptions): Promise<AgentController>;
  subscribe(listener: (message: ServerMessage) => void): () => void;
  snapshot(): RuntimeSnapshot;
  handle(command: ClientCommand): Promise<void>;
  dispose(): Promise<void>;
}
```

Use one promise tail to preserve command order. Emit `command.accepted` before invoking an accepted operation and `command.rejected` for invalid state. `session.new` must reject while streaming; otherwise call `runtime.newSession()`, unsubscribe from the old session, subscribe to `runtime.session`, reset transient IDs, and emit a fresh `state.snapshot`. Catch command failures and emit `command.rejected` with `error instanceof Error ? error.message : "Unknown command failure"`. `dispose()` must unsubscribe once, abort an active run, and dispose the runtime.

- [ ] **Step 7: Implement the real Pi runtime adapter**

Implement `apps/server/src/agent/pi-runtime.ts` using the SDK runtime pattern from `https://pi.dev/docs/latest/sdk`:

```ts
export const createPiRuntime: PiRuntimeFactory = async (workspace) => {
  const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
    const services = await createAgentSessionServices({ cwd });
    return {
      ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent })),
      services,
      diagnostics: services.diagnostics,
    };
  };
  return createAgentSessionRuntime(createRuntime, {
    cwd: workspace,
    agentDir: getAgentDir(),
    sessionManager: SessionManager.continueRecent(workspace),
  });
};
```

If `continueRecent` cannot produce a resumable session, use `SessionManager.create(workspace)`. Adapt the concrete SDK runtime structurally to `PiRuntimePort`; do not wrap or copy credentials, settings, messages, or session files.

- [ ] **Step 8: Verify the controller and real adapter compile**

Run: `corepack pnpm --filter @pi-web/server test -- controller.test.ts && corepack pnpm --filter @pi-web/server typecheck`

Expected: controller tests PASS and TypeScript exits with code 0 against Pi 0.83.0.

- [ ] **Step 9: Commit the runtime controller**

```bash
git add apps/server packages/protocol pnpm-lock.yaml
git commit -m "feat: add serialized Pi runtime controller"
```

---

### Task 3: Loopback Authentication and Fastify Gateway

**Files:**
- Create: `apps/server/src/auth.ts`
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/index.ts`
- Test: `apps/server/src/app.test.ts`

**Interfaces:**
- Consumes: `AgentController`, `ClientCommandSchema`, and `ServerMessage`.
- Produces: `buildApp(options): Promise<FastifyInstance>` and executable local server startup.

- [ ] **Step 1: Write failing HTTP and WebSocket gateway tests**

```ts
// apps/server/src/app.test.ts
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { buildApp } from "./app.js";

const controller = {
  snapshot: () => ({ workspace: "/work", sessionId: "s1", status: "idle" as const, items: [] }),
  subscribe: vi.fn(() => () => undefined),
  handle: vi.fn(async () => undefined),
  dispose: vi.fn(async () => undefined),
};

describe("local gateway", () => {
  it("exchanges the startup token for an HttpOnly cookie", async () => {
    const app = await buildApp({ controller, startupToken: "secret", webRoot: undefined });
    const rejected = await app.inject({ method: "POST", url: "/api/auth/exchange", payload: { token: "wrong" } });
    const accepted = await app.inject({ method: "POST", url: "/api/auth/exchange", payload: { token: "secret" } });
    expect(rejected.statusCode).toBe(401);
    expect(accepted.statusCode).toBe(204);
    expect(accepted.headers["set-cookie"]).toContain("pi_web_session=");
    expect(accepted.headers["set-cookie"]).toContain("HttpOnly");
    await app.close();
  });

  it("sends a snapshot then validates WebSocket commands", async () => {
    const app = await buildApp({ controller, startupToken: "secret", webRoot: undefined });
    await app.ready();
    const auth = await app.inject({ method: "POST", url: "/api/auth/exchange", payload: { token: "secret" } });
    const cookie = auth.cookies[0]?.name + "=" + auth.cookies[0]?.value;
    const socket = await app.injectWS("/api/events", { headers: { cookie, origin: "http://localhost" } });
    const [first] = await once(socket, "message");
    expect(JSON.parse(first.toString())).toMatchObject({ type: "state.snapshot" });
    socket.send(JSON.stringify({ protocolVersion: 1, commandId: "c1", type: "prompt.send", text: "hello" }));
    await vi.waitFor(() => expect(controller.handle).toHaveBeenCalledWith(expect.objectContaining({ commandId: "c1" })));
    socket.close();
    await app.close();
  });
});
```

- [ ] **Step 2: Run the gateway tests to verify they fail**

Run: `corepack pnpm --filter @pi-web/server test -- app.test.ts`

Expected: FAIL because `buildApp` does not exist.

- [ ] **Step 3: Implement local authentication guards**

Implement `apps/server/src/auth.ts` with constant-time token comparison using `timingSafeEqual`, a random 32-byte cookie secret, and these exports:

```ts
export const SESSION_COOKIE = "pi_web_session";
export function createSessionValue(): string;
export function tokenMatches(actual: string, expected: string): boolean;
export function isLoopback(address: string | undefined): boolean;
export function originIsLocal(origin: string | undefined): boolean;
```

`isLoopback` must accept `127.0.0.1`, `::1`, and IPv4-mapped `::ffff:127.0.0.1`. `originIsLocal` must accept missing origins for Fastify injection plus origins whose parsed hostname is `localhost`, `127.0.0.1`, or `[::1]`; malformed origins return false.

- [ ] **Step 4: Implement the Fastify app factory**

Implement `apps/server/src/app.ts` with this boundary:

```ts
export interface ControllerPort {
  snapshot(): RuntimeSnapshot;
  subscribe(listener: (message: ServerMessage) => void): () => void;
  handle(command: ClientCommand): Promise<void>;
  dispose(): Promise<void>;
}

export interface BuildAppOptions {
  controller: ControllerPort;
  startupToken: string;
  webRoot: string | undefined;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance>;
```

Register `@fastify/cookie` and `@fastify/websocket` before routes. Configure WebSocket `maxPayload: 1_048_576` and `perMessageDeflate: false`. `POST /api/auth/exchange` validates `{ token: string }`, compares it with `startupToken`, and sets `pi_web_session` to one process-local random value with `httpOnly`, `sameSite: "strict"`, `path: "/"`, and no persistence date. `GET /api/bootstrap` and `GET /api/events` require loopback address, a valid session cookie, and a local origin.

The WebSocket handler must synchronously register `message`, `close`, and `error` listeners, subscribe the socket to controller messages, and then send a sequence-zero `state.snapshot`. Parse every incoming frame with `ClientCommandSchema.safeParse`; malformed frames receive a `command.rejected` response with command ID `"invalid"` and reason `"Invalid command payload."`. Unsubscribe on close without aborting the controller. Static assets are registered only when `webRoot` is defined, with unknown non-API GET paths returning `index.html`.

- [ ] **Step 5: Implement startup and graceful shutdown**

Implement `apps/server/src/index.ts` to resolve the workspace from `PI_WEB_WORKSPACE ?? process.cwd()`, create a 32-byte URL-safe startup token, create the controller with `createPiRuntime`, build the app, and listen only on `{ host: "127.0.0.1", port: Number(process.env.PORT ?? 4097) }`. Print exactly one launch URL containing `?token=<encoded token>`. On `SIGINT` or `SIGTERM`, call `app.close()`, then `controller.dispose()`, then set `process.exitCode = 0`; guard against running shutdown twice.

- [ ] **Step 6: Verify the gateway**

Run: `corepack pnpm --filter @pi-web/server test -- app.test.ts && corepack pnpm --filter @pi-web/server typecheck`

Expected: gateway tests PASS and TypeScript exits with code 0.

- [ ] **Step 7: Commit the local gateway**

```bash
git add apps/server pnpm-lock.yaml
git commit -m "feat: expose authenticated local agent gateway"
```

---

### Task 4: React Agent Client

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/agent/reducer.ts`
- Create: `apps/web/src/agent/use-agent-connection.ts`
- Create: `apps/web/src/app.tsx`
- Test: `apps/web/src/agent/reducer.test.ts`
- Test: `apps/web/src/app.test.tsx`

**Interfaces:**
- Consumes: all schemas and types from `@pi-web/protocol` plus `/api/auth/exchange` and `/api/events` from Task 3.
- Produces: responsive browser UI and `useAgentConnection(): AgentConnection`.

- [ ] **Step 1: Create the web package and Vite configuration**

```json
// apps/web/package.json
{
  "name": "@pi-web/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite --host 127.0.0.1",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@pi-web/protocol": "workspace:*",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.12",
    "@types/react-dom": "^19.1.9",
    "@vitejs/plugin-react": "^5.0.2",
    "jsdom": "^26.1.0",
    "typescript": "^5.9.3",
    "vite": "8.2.0",
    "vitest": "^3.2.4"
  }
}
```

Configure `vite.config.ts` with the React plugin, `build.outDir: "dist"`, Vitest `environment: "jsdom"`, and development proxies for `/api` HTTP plus WebSocket traffic to `http://127.0.0.1:4097`.

- [ ] **Step 2: Write failing reducer tests**

```ts
// apps/web/src/agent/reducer.test.ts
import { describe, expect, it } from "vitest";
import { initialAgentState, reduceServerMessage } from "./reducer.js";

describe("reduceServerMessage", () => {
  it("replaces local projection with a snapshot", () => {
    const state = reduceServerMessage(initialAgentState, {
      protocolVersion: 1,
      sequence: 0,
      type: "state.snapshot",
      snapshot: { workspace: "/work", sessionId: "s1", status: "idle", items: [] },
    });
    expect(state).toMatchObject({ workspace: "/work", sessionId: "s1", status: "idle", lastSequence: 0 });
  });

  it("appends text deltas to one assistant item", () => {
    const base = { ...initialAgentState, sessionId: "s1", lastSequence: 1 };
    const first = reduceServerMessage(base, { protocolVersion: 1, sequence: 2, type: "agent.event", sessionId: "s1", event: { type: "text.delta", itemId: "a1", delta: "Hel" } });
    const second = reduceServerMessage(first, { protocolVersion: 1, sequence: 3, type: "agent.event", sessionId: "s1", event: { type: "text.delta", itemId: "a1", delta: "lo" } });
    expect(second.items).toContainEqual({ id: "a1", type: "message", role: "assistant", text: "Hello" });
  });

  it("ignores duplicate or stale events", () => {
    const state = { ...initialAgentState, lastSequence: 8 };
    const result = reduceServerMessage(state, { protocolVersion: 1, sequence: 8, type: "agent.event", sessionId: "s1", event: { type: "run.started" } });
    expect(result).toBe(state);
  });
});
```

- [ ] **Step 3: Run reducer tests to verify they fail**

Run: `corepack pnpm install && corepack pnpm --filter @pi-web/web test -- reducer.test.ts`

Expected: FAIL because `reducer.ts` does not exist.

- [ ] **Step 4: Implement the deterministic event reducer**

Implement `apps/web/src/agent/reducer.ts` with:

```ts
export interface AgentState extends RuntimeSnapshot {
  connected: boolean;
  lastSequence: number;
  lastError?: string;
}

export const initialAgentState: AgentState;
export function reduceServerMessage(state: AgentState, message: ServerMessage): AgentState;
```

Snapshots replace workspace, session, status, model, and items. Events with `sequence <= lastSequence` are ignored. `run.started` and `run.finished` update status. Text deltas append to one assistant item by `itemId`. Tool start/update/finish events upsert one tool item. `agent.error` appends an error item and sets status to `error`. A snapshot from reconnection is accepted even when its sequence is zero.

- [ ] **Step 5: Implement authentication and WebSocket lifecycle**

Implement `apps/web/src/agent/use-agent-connection.ts` with:

```ts
export interface AgentConnection {
  state: AgentState;
  send(command: Omit<ClientCommand, "protocolVersion" | "commandId">): string;
}

export function useAgentConnection(): AgentConnection;
```

On mount, read `token` from `window.location.search`. If present, POST JSON to `/api/auth/exchange`, remove the token from browser history with `history.replaceState`, and then connect. Open `ws://` or `wss://` based on `location.protocol` at `/api/events`. Validate every frame with `ServerMessageSchema.safeParse`; invalid frames set `lastError` to `"Server sent an invalid message."`. Mark connectivity on open/close and reconnect after 1 second unless unmounted. `send` creates a `crypto.randomUUID()` command ID, validates the complete command with `ClientCommandSchema`, sends only on an open socket, and otherwise sets `lastError` to `"Agent connection is not open."`.

- [ ] **Step 6: Write failing application interaction tests**

```tsx
// apps/web/src/app.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./app.js";

describe("App", () => {
  it("submits a prompt and exposes stop while running", async () => {
    const send = vi.fn(() => "command-1");
    const user = userEvent.setup();
    const { rerender } = render(<App connection={{ send, state: { connected: true, workspace: "/work", sessionId: "s1", status: "idle", items: [], lastSequence: 0 } }} />);
    await user.type(screen.getByLabelText("Message Pi"), "List files");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(send).toHaveBeenCalledWith({ type: "prompt.send", text: "List files" });

    rerender(<App connection={{ send, state: { connected: true, workspace: "/work", sessionId: "s1", status: "running", items: [], lastSequence: 1 } }} />);
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(send).toHaveBeenCalledWith({ type: "run.abort" });
  });
});
```

- [ ] **Step 7: Implement the accessible application shell**

Implement `apps/web/src/app.tsx` as a controlled component accepting optional `connection`, defaulting to `useAgentConnection()`. Render:

```text
header: product name, connection indicator, model, abbreviated workspace
main: empty-state guidance or ordered transcript items
footer: textarea labeled "Message Pi", queue selector, Send/Stop button
```

When idle, submit `prompt.send`. When running, the selector offers `prompt.steer` and `prompt.followUp`; it must never send `prompt.send`. Enter submits, Shift+Enter inserts a newline, blank text cannot submit, and accepted local submission clears the textarea. Render assistant text with `white-space: pre-wrap`; render tool name, state, and output in a collapsible `details`; render errors with `role="alert"`.

Create `main.tsx`, `index.html`, and `styles.css`. Use a deliberate dark workshop theme with warm paper text, cobalt focus color, a narrow status rail, readable maximum transcript width, visible keyboard focus, and no gradients. At widths below 700px, collapse metadata, use the full viewport width, respect `100dvh`, and keep controls at least 44px high. Honor `prefers-reduced-motion`.

- [ ] **Step 8: Verify the web client**

Run: `corepack pnpm --filter @pi-web/web test && corepack pnpm --filter @pi-web/web typecheck && corepack pnpm --filter @pi-web/web build`

Expected: reducer and component tests PASS, TypeScript exits with code 0, and Vite creates `apps/web/dist`.

- [ ] **Step 9: Commit the React client**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: add local Pi agent client"
```

---

### Task 5: Production Integration and Browser Verification

**Files:**
- Modify: `package.json`
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/src/agent/fake-runtime.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/local-agent.spec.ts`
- Create: `README.md`

**Interfaces:**
- Consumes: built server, built web assets, token exchange, WebSocket protocol, and controller runtime port.
- Produces: one production command, deterministic browser tests, and operator documentation.

- [ ] **Step 1: Add a deterministic fake runtime selected only by environment**

Create `apps/server/src/agent/fake-runtime.ts` implementing `PiRuntimeFactory`. Its session ID is `fake-session`, `prompt(text)` emits `agent_start`, one `message_update` text delta containing `Echo: ${text}`, and `agent_end`; `steer` and `followUp` delegate to `prompt`; `abort` emits `agent_end`; `newSession` replaces the session with a fresh fake session. Select it in `index.ts` only when `PI_WEB_FAKE_RUNTIME === "1"`; all normal starts continue using `createPiRuntime`.

- [ ] **Step 2: Wire production asset paths and root scripts**

Set `webRoot` in `index.ts` to the absolute `apps/web/dist` path when it exists and otherwise leave it undefined. Update root scripts to build protocol, web, then server in that order, and add `start: "pnpm --filter @pi-web/server start"`. Update the server build so output remains executable from `apps/server/dist` without copying browser assets.

- [ ] **Step 3: Write the failing Playwright test**

```ts
// tests/e2e/local-agent.spec.ts
import { expect, test } from "@playwright/test";

test("authenticates and streams a local agent response", async ({ page }) => {
  await page.goto("/?token=e2e-token");
  await expect(page.getByText("Connected")).toBeVisible();
  await page.getByLabel("Message Pi").fill("hello");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Echo: hello")).toBeVisible();
  await expect(page).not.toHaveURL(/token=/);
});
```

- [ ] **Step 4: Configure the real local process for Playwright**

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: { baseURL: "http://127.0.0.1:4177" },
  webServer: {
    command: "corepack pnpm build && corepack pnpm start",
    url: "http://127.0.0.1:4177",
    env: {
      PORT: "4177",
      PI_WEB_FAKE_RUNTIME: "1",
      PI_WEB_STARTUP_TOKEN: "e2e-token",
    },
    reuseExistingServer: false,
  },
});
```

Allow `PI_WEB_STARTUP_TOKEN` in `index.ts` only as an explicit startup-token override, primarily for deterministic tests. It remains server-side and must not be included in bootstrap responses or logs except as the launch URL.

- [ ] **Step 5: Run the browser test to verify integration failures are visible**

Run: `corepack pnpm exec playwright install chromium && corepack pnpm test:e2e`

Expected before final wiring: FAIL if static serving, token exchange, WebSocket connection, or fake streaming is incomplete.

- [ ] **Step 6: Complete integration until the browser test passes**

Correct only concrete failures exposed in Step 5. Preserve the shared protocol and loopback/authentication boundary. Re-run `corepack pnpm test:e2e` after each correction until the test reports `1 passed`.

- [ ] **Step 7: Document operation and security boundaries**

Create `README.md` with exact commands:

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm build
corepack pnpm start
```

Document Node.js 24.12+, the startup working directory, `PI_WEB_WORKSPACE`, `PORT`, Pi credentials under `~/.pi/agent/auth.json`, project resources under `.pi/` and `.agents/skills/`, JSONL session persistence, the printed tokenized browser URL, loopback-only binding, host-level power of `bash` and extensions, graceful shutdown, and the deferred v1 features from Global Constraints.

- [ ] **Step 8: Run the full verification suite**

Run: `corepack pnpm test && corepack pnpm typecheck && corepack pnpm build && corepack pnpm test:e2e`

Expected: every Vitest project passes, every TypeScript project exits with code 0, all packages build, and Playwright reports `1 passed`.

- [ ] **Step 9: Commit production integration**

```bash
git add package.json pnpm-lock.yaml apps/server playwright.config.ts tests README.md
git commit -m "feat: ship host-only Pi web application"
```

---

## Self-Review Results

- Spec coverage: Tasks 1-5 cover the selected Node/Fastify/React stack, versioned WebSocket boundary, one active runtime/run, Pi-native persistence and credentials, loopback authentication, responsive UI, graceful shutdown, and automated verification.
- Scope control: database storage, remote access, project switching, multiple active sessions, child agents, terminals, git review, and extension management are explicitly excluded from v1.
- Placeholder scan: all production interfaces, expected state transitions, commands, test commands, and expected outcomes are specified; no deferred implementation markers remain.
- Type consistency: `ClientCommand`, `ServerMessage`, `RuntimeSnapshot`, `AgentEvent`, `PiRuntimePort`, `AgentController`, and `ControllerPort` retain the same names and responsibilities throughout all tasks.
