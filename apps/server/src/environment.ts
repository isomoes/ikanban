import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createFakeRuntime } from "./agent/fake-runtime.js";
import { createPiRuntime } from "./agent/pi-runtime.js";
import type { StartServerOptions } from "./server.js";

type Environment = Readonly<Record<string, string | undefined>>;

export function resolveStartServerOptions(
  environment: Environment,
  cwd: string,
  moduleUrl: string,
  pathExists: (path: string) => boolean = existsSync,
): StartServerOptions {
  const webRootCandidate = fileURLToPath(new URL("../../web/dist", moduleUrl));
  return {
    workspace: environment.PI_WEB_WORKSPACE ?? cwd,
    webRoot: pathExists(webRootCandidate) ? webRootCandidate : undefined,
    port: Number(environment.PORT ?? 4097),
    runtimeFactory: environment.PI_WEB_FAKE_RUNTIME === "1" ? createFakeRuntime : createPiRuntime,
    ...(environment.PI_WEB_STARTUP_TOKEN === undefined
      ? {}
      : { startupToken: environment.PI_WEB_STARTUP_TOKEN }),
  };
}
