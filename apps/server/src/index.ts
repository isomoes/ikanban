import { fileURLToPath } from "node:url";
import { startServer } from "./server.js";

const workspace = process.env.PI_WEB_WORKSPACE ?? process.cwd();
const server = await startServer({
  workspace,
  webRoot: fileURLToPath(new URL("../../web/dist", import.meta.url)),
  port: Number(process.env.PORT ?? 4097),
});

const shutdown = async () => {
  await server.shutdown();
  process.exitCode = 0;
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
