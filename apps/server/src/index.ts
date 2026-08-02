import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { AgentController } from "./agent/controller.js";
import { createPiRuntime } from "./agent/pi-runtime.js";
import { buildApp } from "./app.js";

const workspace = process.env.PI_WEB_WORKSPACE ?? process.cwd();
const startupToken = randomBytes(32).toString("base64url");
const controller = await AgentController.create({ workspace, runtimeFactory: createPiRuntime });
const app = await buildApp({
  controller,
  startupToken,
  webRoot: fileURLToPath(new URL("../../web/dist", import.meta.url)),
});
const port = Number(process.env.PORT ?? 4097);

await app.listen({ host: "127.0.0.1", port });
console.log(`http://127.0.0.1:${port}/?token=${encodeURIComponent(startupToken)}`);

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await app.close();
  await controller.dispose();
  process.exitCode = 0;
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
