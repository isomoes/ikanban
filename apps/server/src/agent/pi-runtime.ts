import {
  SessionManager,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  type CreateAgentSessionRuntimeFactory,
} from "@earendil-works/pi-coding-agent";
import type { PiRuntimeFactory, PiSessionPort } from "./types.js";

export const createPiRuntime: PiRuntimeFactory = async (workspace, requestedSession) => {
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
  if (requestedSession === null) {
    sessionManager = SessionManager.create(workspace);
  } else if (requestedSession) {
    const selected = (await SessionManager.list(workspace)).find((session) => session.id === requestedSession);
    if (!selected) throw new Error(`Session ${requestedSession} was not found.`);
    sessionManager = SessionManager.open(selected.path);
  } else {
    try {
      sessionManager = SessionManager.continueRecent(workspace);
    } catch {
      sessionManager = SessionManager.create(workspace);
    }
  }

  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: workspace,
    agentDir: getAgentDir(),
    sessionManager,
  });

  const models = (await runtime.services.modelRuntime.getAvailable()).map((model) => ({
    provider: model.provider,
    id: model.id,
    name: model.name,
  }));
  let sessions = await listSessions(workspace);
  const commands = () => {
    const loader = runtime.session.resourceLoader;
    return [
      ...loader.getSkills().skills.map((skill) => ({
        name: `skill:${skill.name}`,
        description: skill.description,
        source: "skill" as const,
      })),
      ...loader.getPrompts().prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        source: "prompt" as const,
      })),
    ];
  };

  async function listSessions(cwd: string) {
    return (await SessionManager.list(cwd)).map((session) => ({
      id: session.id,
      title: session.name || session.firstMessage || "Untitled session",
      modified: session.modified.toISOString(),
      messageCount: session.messageCount,
    }));
  }

  async function refreshSessions() {
    sessions = await listSessions(workspace);
  }

  return {
    get session(): PiSessionPort {
      const session = runtime.session;
      const port: PiSessionPort = {
        get sessionId() { return session.sessionId; },
        get isStreaming() { return session.isStreaming; },
        get messages() { return session.messages; },
        get thinkingLevel() { return session.thinkingLevel; },
        get thinkingLevels() { return session.getAvailableThinkingLevels(); },
        prompt: (text) => session.prompt(text),
        steer: (text) => session.steer(text),
        followUp: (text) => session.followUp(text),
        abort: () => session.abort(),
        setModel: async (provider, modelId) => {
          const model = runtime.services.modelRuntime.getModel(provider, modelId);
          if (!model) throw new Error(`Model ${provider}/${modelId} is not available.`);
          await session.setModel(model);
        },
        setThinkingLevel: (level) => session.setThinkingLevel(level as Parameters<typeof session.setThinkingLevel>[0]),
        subscribe: (listener) => session.subscribe((event) => listener(event as unknown as Parameters<typeof listener>[0])),
      };
      return session.model
        ? { ...port, model: { provider: session.model.provider, id: session.model.id } }
        : port;
    },
    models,
    get sessions() { return sessions; },
    get commands() { return commands(); },
    newSession: async () => {
      const result = await runtime.newSession();
      if (!result.cancelled) await refreshSessions();
      return result;
    },
    switchSession: async (sessionId) => {
      const selected = (await SessionManager.list(workspace)).find((session) => session.id === sessionId);
      if (!selected) throw new Error(`Session ${sessionId} was not found.`);
      const result = await runtime.switchSession(selected.path);
      if (!result.cancelled) await refreshSessions();
      return result;
    },
    dispose: () => runtime.dispose(),
  };
};
