import {
  SessionManager,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  type CreateAgentSessionRuntimeFactory,
} from "@earendil-works/pi-coding-agent";
import type { PiRuntimeFactory, PiSessionPort } from "./types.js";

export const createPiRuntime: PiRuntimeFactory = async (workspace) => {
  const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd, sessionManager, sessionStartEvent }) => {
    const services = await createAgentSessionServices({ cwd });
    return {
      ...(await createAgentSessionFromServices({
        services,
        sessionManager,
        ...(sessionStartEvent ? { sessionStartEvent } : {}),
      })),
      services,
      diagnostics: services.diagnostics,
    };
  };

  let sessionManager: SessionManager;
  try {
    sessionManager = SessionManager.continueRecent(workspace);
  } catch {
    sessionManager = SessionManager.create(workspace);
  }

  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: workspace,
    agentDir: getAgentDir(),
    sessionManager,
  });

  return {
    get session(): PiSessionPort {
      const session = runtime.session;
      const port: PiSessionPort = {
        get sessionId() { return session.sessionId; },
        get isStreaming() { return session.isStreaming; },
        get messages() { return session.messages; },
        prompt: (text) => session.prompt(text),
        steer: (text) => session.steer(text),
        followUp: (text) => session.followUp(text),
        abort: () => session.abort(),
        subscribe: (listener) => session.subscribe((event) => listener(event as unknown as Parameters<typeof listener>[0])),
      };
      return session.model
        ? { ...port, model: { provider: session.model.provider, id: session.model.id } }
        : port;
    },
    newSession: () => runtime.newSession(),
    dispose: () => runtime.dispose(),
  };
};
