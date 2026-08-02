import type { FastifyInstance } from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { ControllerPort, HubPort } from "./app.js";
import { createShutdown, startServer } from "./server.js";

function createController(): HubPort & Pick<ControllerPort, "dispose"> {
  const connection: ControllerPort = {
    snapshot: () => ({
      workspace: "/work",
      sessionId: "s1",
      status: "idle",
      models: [],
      thinkingLevels: [],
      sessions: [],
      workspaces: [],
      commands: [],
      items: [],
    }),
    subscribe: () => () => undefined,
    handle: async () => undefined,
    dispose: vi.fn(async () => undefined),
  };
  return {
    snapshot: connection.snapshot,
    connect: () => connection,
    dispose: vi.fn(async () => undefined),
  };
}

describe("server lifecycle", () => {
  it("disposes the controller when app construction fails", async () => {
    const controller = createController();
    const failure = new Error("build failed");

    await expect(startServer(
      { workspace: "/work", webRoot: undefined, port: 4097 },
      {
        createController: vi.fn(async () => controller),
        buildApp: vi.fn(async () => { throw failure; }),
      },
    )).rejects.toBe(failure);
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("closes the app and disposes the controller when listen fails", async () => {
    const controller = createController();
    const app = {
      listen: vi.fn(async () => { throw new Error("listen failed"); }),
      close: vi.fn(async () => { throw new Error("close failed"); }),
    } as unknown as FastifyInstance;

    await expect(startServer(
      { workspace: "/work", webRoot: undefined, port: 4097 },
      {
        createController: vi.fn(async () => controller),
        buildApp: vi.fn(async () => app),
      },
    )).rejects.toThrow();
    expect(app.close).toHaveBeenCalledOnce();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("disposes the controller once even when app shutdown fails", async () => {
    const controller = createController();
    const app = {
      close: vi.fn(async () => { throw new Error("close failed"); }),
    } as unknown as FastifyInstance;
    const shutdown = createShutdown(app, controller);

    await expect(shutdown()).rejects.toThrow("close failed");
    await expect(shutdown()).rejects.toThrow("close failed");
    expect(app.close).toHaveBeenCalledOnce();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("prints the actual bound port when requested port is zero", async () => {
    const controller = createController();
    const log = vi.fn();
    const started = await startServer(
      { workspace: "/work", webRoot: undefined, port: 0 },
      {
        createController: vi.fn(async () => controller),
        log,
      },
    );

    try {
      const launchUrl = new URL(log.mock.calls[0]?.[0] as string);
      expect(launchUrl.hostname).toBe("127.0.0.1");
      expect(Number(launchUrl.port)).toBeGreaterThan(0);
      expect(launchUrl.search).toBe("");
    } finally {
      await started.shutdown();
    }
  });

  it("uses an explicit runtime without adding credentials to the launch URL", async () => {
    const controller = createController();
    const runtimeFactory = vi.fn();
    const createControllerForRuntime = vi.fn(async () => controller);
    const buildApp = vi.fn(async () => ({
      listen: vi.fn(async () => "http://127.0.0.1:4177"),
      close: vi.fn(async () => undefined),
    } as unknown as FastifyInstance));
    const started = await startServer(
      {
        workspace: "/work",
        webRoot: undefined,
        port: 4177,
        runtimeFactory,
      },
      {
        createController: createControllerForRuntime,
        buildApp,
        log: vi.fn(),
      },
    );

    try {
      expect(createControllerForRuntime).toHaveBeenCalledWith("/work", runtimeFactory);
      expect(buildApp).toHaveBeenCalledWith({ hub: controller, webRoot: undefined });
      expect(started.launchUrl).toBe("http://127.0.0.1:4177/");
    } finally {
      await started.shutdown();
    }
  });
});
