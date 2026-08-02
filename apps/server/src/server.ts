import type { FastifyInstance } from "fastify";
import { AgentController } from "./agent/controller.js";
import { createPiRuntime } from "./agent/pi-runtime.js";
import type { PiRuntimeFactory } from "./agent/types.js";
import { buildApp, type ControllerPort } from "./app.js";

export interface StartServerOptions {
  workspace: string;
  webRoot: string | undefined;
  port: number;
  runtimeFactory?: PiRuntimeFactory;
}

export interface StartServerDependencies {
  createController(workspace: string, runtimeFactory: PiRuntimeFactory): Promise<ControllerPort>;
  buildApp: typeof buildApp;
  log(message: string): void;
}

export interface StartedServer {
  launchUrl: string;
  shutdown(): Promise<void>;
}

const defaultDependencies: StartServerDependencies = {
  createController: (workspace, runtimeFactory) => AgentController.create({ workspace, runtimeFactory }),
  buildApp,
  log: console.log,
};

async function closeResources(app: Pick<FastifyInstance, "close">, controller: Pick<ControllerPort, "dispose">): Promise<void> {
  try {
    await app.close();
  } finally {
    await controller.dispose();
  }
}

export function createShutdown(
  app: Pick<FastifyInstance, "close">,
  controller: Pick<ControllerPort, "dispose">,
): () => Promise<void> {
  let shutdown: Promise<void> | undefined;
  return () => {
    shutdown ??= closeResources(app, controller);
    return shutdown;
  };
}

export async function startServer(
  options: StartServerOptions,
  overrides: Partial<StartServerDependencies> = {},
): Promise<StartedServer> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const controller = await dependencies.createController(options.workspace, options.runtimeFactory ?? createPiRuntime);
  let app: FastifyInstance | undefined;

  try {
    app = await dependencies.buildApp({
      controller,
      webRoot: options.webRoot,
    });
    const address = await app.listen({ host: "127.0.0.1", port: options.port });
    const launchUrl = new URL(address).toString();
    dependencies.log(launchUrl);
    return { launchUrl, shutdown: createShutdown(app, controller) };
  } catch (error) {
    try {
      if (app) await closeResources(app, controller);
      else await controller.dispose();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Server startup and cleanup failed");
    }
    throw error;
  }
}
