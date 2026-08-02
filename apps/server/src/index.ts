import { resolveStartServerOptions } from "./environment.js";
import { startServer } from "./server.js";

const server = await startServer(resolveStartServerOptions(process.env, process.cwd(), import.meta.url));

const shutdown = async () => {
  await server.shutdown();
  process.exitCode = 0;
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
