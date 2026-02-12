#!/usr/bin/env bun

import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { render } from "ink";

import { App } from "./app/App";
import { ConversationManager } from "./runtime/conversation-manager";
import { RuntimeEventBus } from "./runtime/event-bus";
import { OpenCodeRuntime } from "./runtime/opencode-runtime";
import { ProjectRegistry } from "./runtime/project-registry";
import { TaskRegistry } from "./runtime/task-registry";
import { TaskOrchestrator } from "./runtime/task-orchestrator";
import { WorktreeManager } from "./runtime/worktree-manager";

const runtime = new OpenCodeRuntime();
const projectRegistry = new ProjectRegistry({
  stateFilePath: resolve(join(homedir(), ".ikanban", "projects.json")),
});
const taskRegistry = new TaskRegistry({
  stateFilePath: resolve(join(homedir(), ".ikanban", "tasks.json")),
});
const worktreeManager = new WorktreeManager(runtime);
const conversationManager = new ConversationManager(runtime);
const orchestrator = new TaskOrchestrator({
  projectRegistry,
  taskRegistry,
  worktreeManager,
  conversationManager,
});
const eventBus = new RuntimeEventBus();

render(
  <App
    services={{
      runtime,
      projectRegistry,
      orchestrator,
      worktreeManager,
      eventBus,
    }}
    defaultProjectDirectory={process.cwd()}
  />,
);
