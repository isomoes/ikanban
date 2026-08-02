import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import {
  ClientCommandSchema,
  type ClientCommand,
  type RuntimeSnapshot,
  type ServerMessage,
} from "@pi-web/protocol";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { isLoopback, originIsLocal } from "./auth.js";
import { browseDirectories, type DirectoryListing } from "./directories.js";

export interface ControllerPort {
  snapshot(): RuntimeSnapshot;
  subscribe(listener: (message: ServerMessage) => void): () => void;
  handle(command: ClientCommand): Promise<void>;
  dispose(): Promise<void>;
}

export interface HubPort {
  snapshot(): RuntimeSnapshot;
  connect(): ControllerPort;
}

export interface BuildAppOptions {
  hub: HubPort;
  webRoot: string | undefined;
  browseDirectories?: (path: string) => Promise<DirectoryListing>;
}

function originHeader(request: FastifyRequest): string | undefined {
  const origin = request.headers.origin;
  return Array.isArray(origin) ? origin[0] : origin;
}

function guardLocalRequest(request: FastifyRequest, reply: FastifyReply): boolean {
  const injectedWebSocket = request.ws && request.ip === undefined;
  if (!injectedWebSocket && !isLoopback(request.ip)) {
    void reply.code(403).send();
    return false;
  }
  if (!originIsLocal(originHeader(request))) {
    void reply.code(403).send();
    return false;
  }
  return true;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify();
  const browse = options.browseDirectories ?? browseDirectories;

  try {
    await app.register(websocket, {
      options: {
        maxPayload: 1_048_576,
        perMessageDeflate: false,
      },
    });

    app.get("/api/bootstrap", async (request, reply) => {
      if (!guardLocalRequest(request, reply)) return;
      return options.hub.snapshot();
    });

    app.get<{ Querystring: { path?: string } }>("/api/directories", async (request, reply) => {
      if (!guardLocalRequest(request, reply)) return;
      if (!request.query.path) return reply.code(400).send({ error: "Directory path is required." });
      try {
        return await browse(request.query.path);
      } catch (error) {
        return reply.code(400).send({ error: error instanceof Error ? error.message : "Unable to browse directory." });
      }
    });

    app.get("/api/events", {
      websocket: true,
      preValidation: (request, reply, done) => {
        if (guardLocalRequest(request, reply)) done();
      },
    }, (socket) => {
      const controller = options.hub.connect();
      let unsubscribe: (() => void) | undefined;
      let closed = false;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        void controller.dispose();
      };
      const send = (message: ServerMessage) => {
        if (socket.readyState !== socket.OPEN) {
          cleanup();
          return;
        }
        socket.send(JSON.stringify(message));
      };

      socket.on("message", (frame: { toString(): string }) => {
        let payload: unknown;
        try {
          payload = JSON.parse(frame.toString());
        } catch {
          payload = undefined;
        }
        const command = ClientCommandSchema.safeParse(payload);
        if (!command.success) {
          send({
            protocolVersion: 1,
            sequence: 0,
            type: "command.rejected",
            commandId: "invalid",
            reason: "Invalid command payload.",
          });
          return;
        }
        void controller.handle(command.data).catch(() => undefined);
      });
      socket.on("close", cleanup);
      socket.on("error", cleanup);

      unsubscribe = controller.subscribe(send);
      send({
        protocolVersion: 1,
        sequence: 0,
        type: "state.snapshot",
        snapshot: controller.snapshot(),
      });
    });

    if (options.webRoot !== undefined) {
      await app.register(fastifyStatic, {
        root: options.webRoot,
        allowedPath: (pathName) => {
          const path = pathName.startsWith("/") ? pathName.slice(1) : pathName;
          return path !== "api" && !path.startsWith("api/");
        },
      });
      app.setNotFoundHandler((request, reply) => {
        const path = request.url.split("?", 1)[0];
        const isApiPath = path === "/api" || path?.startsWith("/api/");
        if (request.method === "GET" && !isApiPath) return reply.sendFile("index.html");
        return reply.code(404).send();
      });
    }

    return app;
  } catch (error) {
    try {
      await app.close();
    } catch (closeError) {
      throw new AggregateError([error, closeError], "App construction and cleanup failed");
    }
    throw error;
  }
}
