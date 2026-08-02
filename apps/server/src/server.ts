import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AgentController } from "./agent/controller.js";
import { createPiRuntime } from "./agent/pi-runtime.js";
import { buildApp, type ControllerPort } from "./app.js";

export interface StartServerOptions {
  workspace: string;
  webRoot: string | undefined;
  port: number;
}

export interface StartServerDependencies {
  createController(workspace: string): Promise<ControllerPort>;
  buildApp: typeof buildApp;
  createToken(): string;
  log(message: string): void;
}

export interface StartedServer {
  launchUrl: string;
  shutdown(): Promise<void>;
}

const defaultDependencies: StartServerDependencies = {
  createController: (workspace) => AgentController.create({ workspace, runtimeFactory: createPiRuntime }),
  buildApp,
  createToken: () => randomBytes(32).toString("base64url"),
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
  const startupToken = dependencies.createToken();
  const controller = await dependencies.createController(options.workspace);
  let app: FastifyInstance | undefined;

  try {
    app = await dependencies.buildApp({
      controller,
      startupToken,
      webRoot: options.webRoot,
    });
    const address = await app.listen({ host: "127.0.0.1", port: options.port });
    const url = new URL(address);
    url.searchParams.set("token", startupToken);
    const launchUrl = url.toString();
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
