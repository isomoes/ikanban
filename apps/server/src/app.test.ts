import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, type ControllerPort } from "./app.js";
import { isLoopback, originIsLocal } from "./auth.js";

function createController(): ControllerPort {
  return {
    snapshot: vi.fn(() => ({
      workspace: "/work",
      sessionId: "s1",
      status: "idle" as const,
      models: [],
      thinkingLevels: [],
      sessions: [],
      workspaces: [],
      commands: [],
      items: [],
    })),
    subscribe: vi.fn(() => () => undefined),
    handle: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

describe("local access", () => {
  it("recognizes only supported loopback addresses", () => {
    expect(isLoopback("127.0.0.1")).toBe(true);
    expect(isLoopback("::1")).toBe(true);
    expect(isLoopback("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopback("192.168.1.1")).toBe(false);
    expect(isLoopback(undefined)).toBe(false);
  });

  it("accepts local or missing origins and rejects malformed or remote origins", () => {
    expect(originIsLocal(undefined)).toBe(true);
    expect(originIsLocal("http://localhost:4097")).toBe(true);
    expect(originIsLocal("https://127.0.0.1")).toBe(true);
    expect(originIsLocal("http://[::1]:4097")).toBe(true);
    expect(originIsLocal("not a URL")).toBe(false);
    expect(originIsLocal("https://example.com")).toBe(false);
  });
});

describe("local gateway", () => {
  let controller: ControllerPort;
  let hub: {
    snapshot: ControllerPort["snapshot"];
    connect: () => ControllerPort;
  };

  beforeEach(() => {
    controller = createController();
    hub = { snapshot: controller.snapshot, connect: vi.fn(() => controller) };
  });

  it("allows local bootstrap without credentials and rejects remote access", async () => {
    const app = await buildApp({ hub, webRoot: undefined });
    const remoteAddress = await app.inject({ method: "GET", url: "/api/bootstrap", remoteAddress: "192.168.1.8" });
    const remoteOrigin = await app.inject({ method: "GET", url: "/api/bootstrap", headers: { origin: "https://example.com" } });
    const accepted = await app.inject({ method: "GET", url: "/api/bootstrap" });

    expect(remoteAddress.statusCode).toBe(403);
    expect(remoteOrigin.statusCode).toBe(403);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual(controller.snapshot());
    await app.close();
  });

  it("sends a snapshot then validates WebSocket commands", async () => {
    const app = await buildApp({ hub, webRoot: undefined });
    await app.ready();
    let resolveFirst!: (message: unknown) => void;
    const firstMessage = new Promise<unknown>((resolve) => { resolveFirst = resolve; });
    const socket = await app.injectWS(
      "/api/events",
      { headers: { origin: "http://localhost" } },
      { onInit: (client) => client.once("message", resolveFirst) },
    );
    const first = await firstMessage;

    expect(JSON.parse(String(first))).toMatchObject({ protocolVersion: 1, sequence: 0, type: "state.snapshot" });
    const rejectedMessage = once(socket, "message");
    socket.send("not json");
    const [rejected] = await rejectedMessage;
    expect(JSON.parse(rejected.toString())).toMatchObject({
      type: "command.rejected",
      commandId: "invalid",
      reason: "Invalid command payload.",
    });
    socket.send(JSON.stringify({ protocolVersion: 1, commandId: "c1", type: "prompt.send", text: "hello" }));
    await vi.waitFor(() => expect(controller.handle).toHaveBeenCalledWith(expect.objectContaining({ commandId: "c1" })));
    socket.close();
    await app.close();
  });

  it("attaches WebSocket listeners before a client can send a command", async () => {
    const app = await buildApp({ hub, webRoot: undefined });
    await app.ready();
    const socket = await app.injectWS(
      "/api/events",
      { headers: { origin: "http://localhost" } },
      {
        onOpen: (client) => client.send(JSON.stringify({
          protocolVersion: 1,
          commandId: "immediate",
          type: "session.new",
        })),
      },
    );
    await vi.waitFor(() => expect(controller.handle).toHaveBeenCalledWith(expect.objectContaining({ commandId: "immediate" })));
    socket.close();
    await app.close();
  });

  it("does not send controller messages to a closing WebSocket", async () => {
    let listener: Parameters<ControllerPort["subscribe"]>[0] | undefined;
    const unsubscribe = vi.fn();
    controller.subscribe = vi.fn((next) => {
      listener = next;
      return unsubscribe;
    });
    const app = await buildApp({ hub, webRoot: undefined });
    await app.ready();
    const socket = await app.injectWS("/api/events", { headers: { origin: "http://localhost" } });
    const serverSocket = [...app.websocketServer.clients][0];
    expect(serverSocket).toBeDefined();
    const send = vi.spyOn(serverSocket!, "send");

    serverSocket!.close();
    listener?.({
      protocolVersion: 1,
      sequence: 1,
      type: "command.accepted",
      commandId: "late",
    });

    expect(send).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalledOnce();
    socket.close();
    await app.close();
  });

  it("reserves API paths from static files, including dotfiles", async () => {
    const webRoot = await mkdtemp(join(tmpdir(), "pi-web-static-"));
    await mkdir(join(webRoot, "api"));
    await writeFile(join(webRoot, "index.html"), "app shell");
    await writeFile(join(webRoot, "api", "leak.txt"), "not an API response");
    await writeFile(join(webRoot, "api", ".secret"), "hidden secret");
    const app = await buildApp({ hub, webRoot });

    try {
      const asset = await app.inject({ method: "GET", url: "/api/leak.txt" });
      const dotfile = await app.inject({ method: "GET", url: "/api/.secret" });
      const spa = await app.inject({ method: "GET", url: "/board/one" });

      expect(asset.statusCode).toBe(404);
      expect(asset.body).not.toContain("not an API response");
      expect(dotfile.statusCode).toBe(404);
      expect(dotfile.body).not.toContain("hidden secret");
      expect(spa.body).toBe("app shell");
    } finally {
      await app.close();
      await rm(webRoot, { recursive: true, force: true });
    }
  });

  it("guards and serves host directory listings", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-web-picker-"));
    await mkdir(join(root, "project"));
    const app = await buildApp({ hub, webRoot: undefined });

    try {
      const remote = await app.inject({
        method: "GET",
        url: `/api/directories?path=${encodeURIComponent(root)}`,
        remoteAddress: "192.168.1.8",
      });
      const accepted = await app.inject({ method: "GET", url: `/api/directories?path=${encodeURIComponent(root)}` });

      expect(remote.statusCode).toBe(403);
      expect(accepted.statusCode).toBe(200);
      expect(accepted.json()).toMatchObject({
        path: root,
        directories: [{ name: "project", path: join(root, "project") }],
      });
    } finally {
      await app.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
