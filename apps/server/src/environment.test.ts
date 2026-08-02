import { describe, expect, it } from "vitest";
import { createFakeRuntime } from "./agent/fake-runtime.js";
import { createPiRuntime } from "./agent/pi-runtime.js";
import { resolveStartServerOptions } from "./environment.js";

describe("resolveStartServerOptions", () => {
  it("selects the fake runtime only for the explicit environment flag", () => {
    const fake = resolveStartServerOptions(
      { PI_WEB_FAKE_RUNTIME: "1" },
      "/work",
      "file:///project/apps/server/dist/index.js",
      () => false,
    );
    const normal = resolveStartServerOptions(
      { PI_WEB_FAKE_RUNTIME: "true" },
      "/work",
      "file:///project/apps/server/dist/index.js",
      () => false,
    );

    expect(fake.runtimeFactory).toBe(createFakeRuntime);
    expect(normal.runtimeFactory).toBe(createPiRuntime);
  });

  it("passes deterministic startup settings and only an existing web root", () => {
    const existing = resolveStartServerOptions(
      { PI_WEB_WORKSPACE: "/workspace", PI_WEB_STARTUP_TOKEN: "fixed", PORT: "4177" },
      "/fallback",
      "file:///project/apps/server/dist/index.js",
      (path) => path === "/project/apps/web/dist",
    );
    const missing = resolveStartServerOptions(
      {},
      "/fallback",
      "file:///project/apps/server/dist/index.js",
      () => false,
    );

    expect(existing).toMatchObject({
      workspace: "/workspace",
      webRoot: "/project/apps/web/dist",
      port: 4177,
      startupToken: "fixed",
    });
    expect(missing).toMatchObject({ workspace: "/fallback", webRoot: undefined, port: 4097 });
    expect(missing.startupToken).toBeUndefined();
  });
});
