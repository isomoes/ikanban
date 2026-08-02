import cookie from "@fastify/cookie";
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
import { SESSION_COOKIE, createSessionValue, isLoopback, originIsLocal, tokenMatches } from "./auth.js";

export interface ControllerPort {
  snapshot(): RuntimeSnapshot;
  subscribe(listener: (message: ServerMessage) => void): () => void;
  handle(command: ClientCommand): Promise<void>;
  dispose(): Promise<void>;
}

export interface BuildAppOptions {
  controller: ControllerPort;
  startupToken: string;
  webRoot: string | undefined;
}

function originHeader(request: FastifyRequest): string | undefined {
  const origin = request.headers.origin;
  return Array.isArray(origin) ? origin[0] : origin;
}

function guardLocalSession(request: FastifyRequest, reply: FastifyReply, sessionValue: string): boolean {
  const injectedWebSocket = request.ws && request.ip === undefined;
  if (!injectedWebSocket && !isLoopback(request.ip)) {
    void reply.code(403).send();
    return false;
  }
  if (!originIsLocal(originHeader(request))) {
    void reply.code(403).send();
    return false;
  }
  const session = request.cookies[SESSION_COOKIE];
  if (session === undefined || !tokenMatches(session, sessionValue)) {
    void reply.code(401).send();
    return false;
  }
  return true;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify();
  const sessionValue = createSessionValue();

  await app.register(cookie);
  await app.register(websocket, {
    options: {
      maxPayload: 1_048_576,
      perMessageDeflate: false,
    },
  });

  app.post("/api/auth/exchange", async (request, reply) => {
    const body = request.body;
    if (typeof body !== "object" || body === null || !("token" in body) || typeof body.token !== "string") {
      return reply.code(400).send();
    }
    if (!tokenMatches(body.token, options.startupToken)) return reply.code(401).send();
    return reply
      .setCookie(SESSION_COOKIE, sessionValue, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      })
      .code(204)
      .send();
  });

  app.get("/api/bootstrap", async (request, reply) => {
    if (!guardLocalSession(request, reply, sessionValue)) return;
    return options.controller.snapshot();
  });

  app.get("/api/events", {
    websocket: true,
    preValidation: (request, reply, done) => {
      if (guardLocalSession(request, reply, sessionValue)) done();
    },
  }, (socket) => {
    let unsubscribe: (() => void) | undefined;
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      unsubscribe?.();
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
        socket.send(JSON.stringify({
          protocolVersion: 1,
          sequence: 0,
          type: "command.rejected",
          commandId: "invalid",
          reason: "Invalid command payload.",
        } satisfies ServerMessage));
        return;
      }
      void options.controller.handle(command.data).catch(() => undefined);
    });
    socket.on("close", cleanup);
    socket.on("error", cleanup);

    unsubscribe = options.controller.subscribe((message) => socket.send(JSON.stringify(message)));
    socket.send(JSON.stringify({
      protocolVersion: 1,
      sequence: 0,
      type: "state.snapshot",
      snapshot: options.controller.snapshot(),
    } satisfies ServerMessage));
  });

  if (options.webRoot !== undefined) {
    await app.register(fastifyStatic, { root: options.webRoot });
    app.setNotFoundHandler((request, reply) => {
      const path = request.url.split("?", 1)[0];
      const isApiPath = path === "/api" || path?.startsWith("/api/");
      if (request.method === "GET" && !isApiPath) return reply.sendFile("index.html");
      return reply.code(404).send();
    });
  }

  return app;
}
