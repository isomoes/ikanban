import { once } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, type ControllerPort } from "./app.js";
import { isLoopback, originIsLocal, tokenMatches } from "./auth.js";

function createController(): ControllerPort {
  return {
    snapshot: vi.fn(() => ({ workspace: "/work", sessionId: "s1", status: "idle" as const, items: [] })),
    subscribe: vi.fn(() => () => undefined),
    handle: vi.fn(async () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

describe("local authentication", () => {
  it("compares tokens and recognizes only supported loopback addresses", () => {
    expect(tokenMatches("secret", "secret")).toBe(true);
    expect(tokenMatches("wrong", "secret")).toBe(false);
    expect(tokenMatches("short", "a-different-length")).toBe(false);
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

  beforeEach(() => {
    controller = createController();
  });

  it("exchanges the startup token for an HttpOnly session cookie", async () => {
    const app = await buildApp({ controller, startupToken: "secret", webRoot: undefined });
    const invalidPayload = await app.inject({ method: "POST", url: "/api/auth/exchange", payload: {} });
    const rejected = await app.inject({ method: "POST", url: "/api/auth/exchange", payload: { token: "wrong" } });
    const accepted = await app.inject({ method: "POST", url: "/api/auth/exchange", payload: { token: "secret" } });

    expect(invalidPayload.statusCode).toBe(400);
    expect(rejected.statusCode).toBe(401);
    expect(accepted.statusCode).toBe(204);
    expect(accepted.headers["set-cookie"]).toContain("pi_web_session=");
    expect(accepted.headers["set-cookie"]).toContain("HttpOnly");
    expect(accepted.headers["set-cookie"]).toContain("SameSite=Strict");
    expect(accepted.headers["set-cookie"]).not.toContain("Expires=");
    await app.close();
  });

  it("guards bootstrap with the session cookie and local origin", async () => {
    const app = await buildApp({ controller, startupToken: "secret", webRoot: undefined });
    const unauthenticated = await app.inject({ method: "GET", url: "/api/bootstrap" });
    const auth = await app.inject({ method: "POST", url: "/api/auth/exchange", payload: { token: "secret" } });
    const cookie = `${auth.cookies[0]?.name}=${auth.cookies[0]?.value}`;
    const remoteOrigin = await app.inject({ method: "GET", url: "/api/bootstrap", headers: { cookie, origin: "https://example.com" } });
    const accepted = await app.inject({ method: "GET", url: "/api/bootstrap", headers: { cookie } });

    expect(unauthenticated.statusCode).toBe(401);
    expect(remoteOrigin.statusCode).toBe(403);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toEqual(controller.snapshot());
    await app.close();
  });

  it("sends a snapshot then validates WebSocket commands", async () => {
    const app = await buildApp({ controller, startupToken: "secret", webRoot: undefined });
    await app.ready();
    const auth = await app.inject({ method: "POST", url: "/api/auth/exchange", payload: { token: "secret" } });
    const cookie = `${auth.cookies[0]?.name}=${auth.cookies[0]?.value}`;
    let resolveFirst!: (message: unknown) => void;
    const firstMessage = new Promise<unknown>((resolve) => { resolveFirst = resolve; });
    const socket = await app.injectWS(
      "/api/events",
      { headers: { cookie, origin: "http://localhost" } },
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
    const app = await buildApp({ controller, startupToken: "secret", webRoot: undefined });
    await app.ready();
    const auth = await app.inject({ method: "POST", url: "/api/auth/exchange", payload: { token: "secret" } });
    const cookie = `${auth.cookies[0]?.name}=${auth.cookies[0]?.value}`;
    const socket = await app.injectWS(
      "/api/events",
      { headers: { cookie, origin: "http://localhost" } },
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
});
