import type {
  OpenCodeClient,
  SessionInfo,
  SessionMessageInfo,
  SessionPromptInput,
  IntegrationInfo,
} from "@opencode/client"
import { createClient } from "../client"
import type * as UI from "./types"
import { fileView, messageViews, modelView, permissionView, projectView, questionView, sessionView } from "./convert"
import { subscribeUIEvents } from "./events"
import { mergeConfig, updateServerConfig } from "./config"
type RequestOptions = NonNullable<Parameters<OpenCodeClient["server"]["info"]>[0]>

export type UIClientOptions = {
  baseUrl: string
  headers?: HeadersInit
  fetch?: typeof globalThis.fetch
  directory?: string
  signal?: AbortSignal
  throwOnError?: boolean
}
type Scope = { directory?: string }
type SessionInput = Scope & { sessionID: string }
type Options = RequestOptions & { throwOnError?: boolean }
type Result<T> = { data: T; error?: never; response?: Response }
const result = <T>(data: T): Result<T> => ({ data })
const unavailable = (feature: string): never => {
  throw new Error(`${feature} is not available in the OpenCode V2 API.`)
}

/** UI-facing operations. Every network operation is implemented by the generated V2 client. */
export function createUIClient(options: UIClientOptions) {
  const native = createClient(options)
  const request = (opts?: Options): RequestOptions => ({
    signal: opts?.signal ?? options.signal,
    headers: opts?.headers,
  })
  const location = (input?: Scope) => {
    const directory = input?.directory ?? options.directory
    return directory ? { directory } : undefined
  }
  const sessions = new Map<string, SessionInfo>()
  const remember = (session: SessionInfo) => {
    sessions.set(session.id, session)
    return session
  }
  const getSession = async (sessionID: string, opts?: Options) =>
    remember(await native.session.get({ sessionID }, request(opts)))
  // Archive is a presentation preference; V2 has no archive operation.
  const archiveKey = `ikanban.v2.archived:${options.baseUrl}`
  const archived = (): Record<string, number> => {
    try {
      return JSON.parse(localStorage.getItem(archiveKey) ?? "{}")
    } catch {
      return {}
    }
  }
  const view = (session: SessionInfo): UI.Session => {
    const info = sessionView(session)
    info.time = { ...info.time, archived: info.time.archived ?? archived()[info.id] }
    return info
  }
  const getMessages = async (input: SessionInput & { limit?: number; before?: string }, opts?: Options) => {
    const session = sessions.get(input.sessionID) ?? (await getSession(input.sessionID, opts))
    const messages: SessionMessageInfo[] = []
    let cursor = input.before
    // Page by native cursor, not by the number of visible messages (V2 also has control records).
    do {
      const remaining = input.limit ? input.limit - messages.length : 200
      const page = await native.message.list(
        {
          sessionID: input.sessionID,
          order: cursor ? undefined : "desc",
          limit: remaining > 0 ? Math.min(remaining, 200) : 200,
          cursor,
        },
        request(opts),
      )
      messages.push(...page.data)
      cursor = page.cursor.next ?? undefined
      if (
        !cursor ||
        (input.limit && messages.length >= input.limit && messages.some((message) => message.type === "user"))
      )
        break
    } while (true)
    messages.sort((a, b) => a.id.localeCompare(b.id))
    return { ...result(messageViews(session, messages)), cursor }
  }
  const getConfig = async (input?: Scope): Promise<Result<UI.Config>> => {
    const entries = await native.config.get({ location: location(input) }, request())
    const merged: UI.Config = {}
    for (const entry of entries) if (entry.type === "document") mergeConfig(merged, entry.info)
    // Sharing was removed from the V2 HTTP contract.
    return result({ ...merged, share: "disabled" })
  }
  const getGlobalConfig = async (): Promise<Result<UI.Config>> => {
    const entries = await native.config.get(undefined, request())
    const root = entries.find((entry) => entry.type === "directory")?.path
    const merged: UI.Config = {}
    for (const entry of entries) {
      if (entry.type === "document" && entry.path && root && entry.path.replace(/[\\/][^\\/]+$/, "") === root)
        mergeConfig(merged, entry.info)
    }
    return result({ ...merged, share: "disabled" })
  }
  const config = {
    get: getConfig,
    update: async (input: { config: UI.Config } & Scope) => {
      await updateServerConfig(native, input.config, options.signal)
      return getConfig(input)
    },
  }
  const integrations = async () => (await native.integration.list({ location: location() }, request())).data
  const integrationFor = async (providerID: string): Promise<IntegrationInfo> => {
    const [providers, connections] = await Promise.all([
      native.provider.list({ location: location() }, request()),
      integrations(),
    ])
    const id = providers.data.find((provider) => provider.id === providerID)?.integrationID ?? providerID
    const integration = connections.find((item) => item.id === id)
    if (!integration) throw new Error(`No authentication integration for ${providerID}`)
    return integration
  }
  const attempts = new Map<string, UI.ProviderAuthAuthorization>()
  const select = async (
    input: SessionInput & {
      agent?: string
      model?: { providerID: string; modelID: string } | string
      variant?: string
    },
  ) => {
    const current = await getSession(input.sessionID)
    if (current.revert) await native.session.revert.commit({ sessionID: input.sessionID }, request())
    if (input.agent) await native.session.switchAgent({ sessionID: input.sessionID, agent: input.agent }, request())
    if (input.model) {
      const ref =
        typeof input.model === "string"
          ? { providerID: input.model.split("/")[0], id: input.model.slice(input.model.indexOf("/") + 1) }
          : { providerID: input.model.providerID, id: input.model.modelID }
      await native.session.switchModel(
        { sessionID: input.sessionID, model: { ...ref, variant: input.variant } },
        request(),
      )
    }
  }
  const attachments = (
    parts: (UI.TextPartInput | UI.FilePartInput | UI.AgentPartInput)[],
  ): Pick<SessionPromptInput, "text" | "files" | "agents"> => ({
    text: parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
    files: parts
      .filter((part) => part.type === "file")
      .map((part) => ({
        uri: part.url,
        name: part.filename,
        mention: part.source
          ? { start: part.source.text.start, end: part.source.text.end, text: part.source.text.value }
          : undefined,
      })),
    agents: parts
      .filter((part) => part.type === "agent")
      .map((part) => ({
        name: part.name,
        mention: part.source ? { start: part.source.start, end: part.source.end, text: part.source.value } : undefined,
      })),
  })
  const session = {
    list: async (
      input: Scope & { roots?: boolean; limit?: number; search?: string; start?: number } = {},
      opts?: Options,
    ) => {
      const data: UI.Session[] = []
      let cursor: string | undefined
      do {
        const page = await native.session.list(
          {
            directory: input.directory ?? options.directory,
            parentID: input.roots ? null : undefined,
            search: input.search,
            limit: Math.min(input.limit ? input.limit - data.length : 200, 200),
            cursor,
            order: cursor ? undefined : "desc",
          },
          request(opts),
        )
        data.push(...page.data.map((item) => view(remember(item))).filter((item) => !item.time.archived))
        cursor = page.cursor.next ?? undefined
        if (!cursor || (input.limit && data.length >= input.limit)) break
      } while (true)
      return result(data)
    },
    get: async (input: SessionInput, opts?: Options) => result(view(await getSession(input.sessionID, opts))),
    create: async (input: Scope & { title?: string } = {}) =>
      result(view(remember(await native.session.create({ location: location(input), title: input.title }, request())))),
    delete: async (input: SessionInput) => {
      await native.session.remove(input, request())
      return result(true)
    },
    update: async (input: SessionInput & { title?: string; time?: { archived?: number } }) => {
      if (input.title !== undefined)
        await native.session.update({ sessionID: input.sessionID, title: input.title }, request())
      if (input.time?.archived !== undefined)
        localStorage.setItem(archiveKey, JSON.stringify({ ...archived(), [input.sessionID]: input.time.archived }))
      return result(view(await getSession(input.sessionID)))
    },
    fork: async (input: SessionInput & { messageID?: string }) =>
      result(
        view(remember(await native.session.fork({ sessionID: input.sessionID, before: input.messageID }, request()))),
      ),
    messages: getMessages,
    status: async () => {
      const active = await native.session.active(request())
      return result(Object.fromEntries(Object.keys(active).map((id) => [id, { type: "busy" } as UI.SessionStatus])))
    },
    abort: async (input: SessionInput) => {
      await native.session.interrupt({ sessionID: input.sessionID }, request())
      return result(true)
    },
    promptAsync: async (
      input: SessionInput & {
        messageID?: string
        agent?: string
        model?: { providerID: string; modelID: string }
        variant?: string
        parts: (UI.TextPartInput | UI.FilePartInput | UI.AgentPartInput)[]
      },
    ) => {
      await select(input)
      return result(
        await native.session.prompt(
          { sessionID: input.sessionID, id: input.messageID, ...attachments(input.parts) },
          request(),
        ),
      )
    },
    command: async (
      input: SessionInput & {
        command: string
        arguments: string
        agent?: string
        model?: string
        variant?: string
        parts?: UI.FilePartInput[]
      },
    ) => {
      await select(input)
      await native.session.command(
        { sessionID: input.sessionID, name: input.command, ...attachments(input.parts ?? []), text: input.arguments },
        request(),
      )
      return result(true)
    },
    summarize: async (input: SessionInput & { providerID?: string; modelID?: string }) => {
      await native.session.compact({ sessionID: input.sessionID }, request())
      return result(true)
    },
    revert: async (input: SessionInput & { messageID: string; partID?: string }) => {
      await native.session.revert.stage(
        { sessionID: input.sessionID, messageID: input.messageID, files: true },
        request(),
      )
      return result(view(await getSession(input.sessionID)))
    },
    unrevert: async (input: SessionInput) => {
      await native.session.revert.clear(input, request())
      return result(view(await getSession(input.sessionID)))
    },
    diff: async (input: SessionInput & { messageID?: string }) =>
      result(
        await native.session.diff({ sessionID: input.sessionID, from: input.messageID, context: 100000 }, request()),
      ),
    todo: async (input: SessionInput) => {
      const messages = await getMessages(input)
      let todos: UI.Todo[] = []
      for (const message of messages.data)
        for (const part of message.parts) {
          if (part.type !== "tool" || !["todowrite", "todo"].includes(part.tool)) continue
          const value = part.state.input.todos
          if (Array.isArray(value))
            todos = value
              .filter(
                (item): item is UI.Todo =>
                  typeof item === "object" &&
                  item !== null &&
                  typeof item.content === "string" &&
                  typeof item.status === "string",
              )
              .map((item) => ({ ...item, priority: item.priority ?? "medium" }))
        }
      return result(todos)
    },
    share: async (_input: SessionInput): Promise<Result<{ url: string }>> => unavailable("Session sharing"),
    unshare: async (_input: SessionInput): Promise<Result<UI.Session>> => unavailable("Session sharing"),
  }
  const resolveProject = async (input?: Scope) =>
    (await native.location.get({ location: location(input) }, request())).project.id
  const fileNode = (entry: { path: string; type: "file" | "directory" }, directory: string): UI.FileNode => ({
    ...entry,
    name: entry.path.split(/[\\/]/).filter(Boolean).pop() ?? entry.path,
    absolute: /^(\/|[A-Za-z]:)/.test(entry.path) ? entry.path : `${directory}/${entry.path}`,
    ignored: false,
  })
  return {
    native,
    session,
    global: {
      health: async () => {
        const info = await native.server.info(request())
        return result({ healthy: info.version.startsWith("2."), version: info.version })
      },
      config: { ...config, get: getGlobalConfig },
      dispose: async () => {
        await native.location.reload(request())
        return result(true)
      },
      event: async (input: { signal?: AbortSignal; onSseError?: (error: unknown) => void } = {}) => ({
        stream: subscribeUIEvents(native, { signal: input.signal ?? options.signal, sessionView: view }),
      }),
    },
    config,
    path: {
      get: async (input?: Scope) => {
        const value = await native.location.get({ location: location(input) }, request())
        return result<UI.Path>({
          directory: value.directory,
          worktree: value.project.directory,
          home: "",
          config: "",
          state: "",
        })
      },
    },
    project: {
      list: async () => result((await native.project.list(request())).map(projectView)),
      current: async (input?: Scope) => {
        const loc = await native.location.get({ location: location(input) }, request())
        const projects = await native.project.list(request())
        const project = projects.find((item) => item.id === loc.project.id)
        if (!project) throw new Error(`Project ${loc.project.id} not found`)
        return result(projectView(project))
      },
      update: async (
        input: Scope & {
          projectID: string
          name?: string
          icon?: { override?: string; color?: string }
          commands?: { start?: string }
        },
      ) => result(projectView(await native.project.update(input, request()))),
    },
    app: {
      agents: async () =>
        result(
          (await native.agent.list({ location: location() }, request())).data.map(
            (agent): UI.Agent => ({
              ...agent,
              name: agent.id,
              model: agent.model ? { providerID: agent.model.providerID, modelID: agent.model.id } : undefined,
              variant: agent.model?.variant,
              permission: agent.permissions,
              options: agent.request.body,
            }),
          ),
        ),
      skills: async (input?: Scope) => result((await native.skill.list({ location: location(input) }, request())).data),
    },
    command: {
      list: async () =>
        result(
          (await native.command.list({ location: location() }, request())).data.map(
            (command): UI.Command => ({ ...command, template: "" }),
          ),
        ),
    },
    provider: {
      list: async () => {
        const [providers, models, connections] = await Promise.all([
          native.provider.list({ location: location() }, request()),
          native.model.list({ location: location() }, request()),
          integrations(),
        ])
        const all: UI.Provider[] = providers.data.map((provider) => ({
          id: provider.id,
          name: provider.name,
          integrationID: provider.integrationID,
          source: connections
            .find((item) => item.id === (provider.integrationID ?? provider.id))
            ?.connections.some((item) => item.type === "env")
            ? "env"
            : "api",
          env: [],
          options: provider.settings ?? {},
          models: Object.fromEntries(
            models.data
              .filter((model) => model.providerID === provider.id)
              .map((model) => [model.id, modelView(model)]),
          ),
        }))
        return result<UI.ProviderListResponse>({
          all,
          connected: providers.data
            .filter(
              (provider) =>
                provider.activation !== "disabled" &&
                models.data.some((model) => model.providerID === provider.id && model.enabled),
            )
            .map((provider) => provider.id),
          default: Object.fromEntries(all.map((provider) => [provider.id, Object.keys(provider.models)[0] ?? ""])),
        })
      },
      auth: async () => {
        const [providers, connections] = await Promise.all([
          native.provider.list({ location: location() }, request()),
          integrations(),
        ])
        return result<UI.ProviderAuthResponse>(
          Object.fromEntries(
            providers.data.map((provider) => [
              provider.id,
              (connections.find((item) => item.id === (provider.integrationID ?? provider.id))?.methods ?? []).flatMap<
                UI.ProviderAuthResponse[string][number]
              >((method) =>
                method.type === "oauth"
                  ? [{ type: "oauth", label: method.label, methodID: method.id, form: method.form }]
                  : method.type === "key"
                    ? [{ type: "api", label: method.label ?? "API key", methodID: "key", form: method.form }]
                    : [],
              ),
            ]),
          ),
        )
      },
      oauth: {
        cancel: async (providerID: string) => {
          const attempt = attempts.get(providerID)
          if (!attempt) return
          attempts.delete(providerID)
          await native.integration.oauth.cancel(
            { integrationID: attempt.integrationID, attemptID: attempt.attemptID, location: location() },
            request(),
          )
        },
        authorize: async (
          input: { providerID: string; method: number; answer?: Record<string, string | number | boolean | string[]> },
          opts?: Options,
        ) => {
          const integration = await integrationFor(input.providerID)
          const method = integration.methods.filter((item) => item.type === "oauth" || item.type === "key")[
            input.method
          ]
          if (method?.type !== "oauth") throw new Error("Select an OAuth authentication method")
          const attempt = (
            await native.integration.oauth.connect(
              { integrationID: integration.id, methodID: method.id, location: location(), answer: input.answer },
              request(opts),
            )
          ).data
          const authorization: UI.ProviderAuthAuthorization = {
            ...attempt,
            method: attempt.mode,
            integrationID: integration.id,
          }
          attempts.set(input.providerID, authorization)
          return result(authorization)
        },
        callback: async (input: { providerID: string; method?: number; code?: string }, opts?: Options) => {
          const attempt = attempts.get(input.providerID)
          if (!attempt) throw new Error("Start a new OAuth connection")
          const id = { integrationID: attempt.integrationID, attemptID: attempt.attemptID, location: location() }
          if (input.code) await native.integration.oauth.complete({ ...id, code: input.code }, request(opts))
          while (true) {
            const status = (await native.integration.oauth.status(id, request(opts))).data
            if (status.status === "complete") {
              attempts.delete(input.providerID)
              return result(true)
            }
            if (status.status === "failed") throw new Error(status.message)
            if (status.status === "expired") throw new Error("OAuth connection expired")
            await new Promise((resolve) => setTimeout(resolve, 1000))
            request(opts).signal?.throwIfAborted()
          }
        },
      },
    },
    auth: {
      set: async (input: {
        providerID: string
        auth: { type: "api"; key: string }
        answer?: Record<string, string | number | boolean | string[]>
      }) => {
        const integration = await integrationFor(input.providerID)
        await native.integration.connect.key(
          { integrationID: integration.id, key: input.auth.key, location: location(), answer: input.answer },
          request(),
        )
        return result(true)
      },
      remove: async (input: { providerID: string }) => {
        const integration = await integrationFor(input.providerID)
        for (const connection of integration.connections)
          if (connection.type === "credential")
            await native.credential.remove({ credentialID: connection.id }, request())
        return result(true)
      },
    },
    permission: {
      list: async (input?: Scope) =>
        result(
          (await native.permission.request.list({ location: location(input) }, request())).data.map(permissionView),
        ),
      respond: async (
        input: Scope & { sessionID: string; permissionID: string; response: "once" | "always" | "reject" },
      ) => {
        await native.permission.reply(
          { sessionID: input.sessionID, requestID: input.permissionID, decision: input.response },
          request(),
        )
        return result(true)
      },
      reply: async (input: Scope & { sessionID: string; requestID: string; reply: "once" | "always" | "reject" }) => {
        await native.permission.reply(
          { sessionID: input.sessionID, requestID: input.requestID, decision: input.reply },
          request(),
        )
        return result(true)
      },
    },
    question: {
      list: async () => result((await native.form.list({ location: location() }, request())).data.map(questionView)),
      reply: async (input: { sessionID: string; requestID: string; answers: UI.QuestionAnswer[] }) => {
        const form = await native.session.form.get({ sessionID: input.sessionID, formID: input.requestID }, request())
        const answer: Record<string, string | number | boolean | string[]> = {}
        for (const [index, field] of form.fields.filter((field) => !("hidden" in field && field.hidden)).entries()) {
          const values = input.answers[index] ?? []
          const mapped = values.map(
            (value) =>
              ("options" in field ? field.options?.find((option) => option.label === value)?.value : undefined) ??
              value,
          )
          answer[field.key] =
            field.type === "multiselect"
              ? mapped.map(String)
              : field.type === "boolean"
                ? mapped[0] === "true"
                : field.type === "number" || field.type === "integer"
                  ? Number(mapped[0])
                  : String(mapped[0] ?? "")
        }
        await native.session.form.reply({ sessionID: input.sessionID, formID: input.requestID, answer }, request())
        return result(true)
      },
      reject: async (input: { sessionID: string; requestID: string }) => {
        await native.session.form.cancel({ sessionID: input.sessionID, formID: input.requestID }, request())
        return result(true)
      },
    },
    file: {
      status: async (input?: Scope) => result((await native.vcs.status({ location: location(input) }, request())).data),
      list: async (input: Scope & { path: string }) => {
        const value = await native.file.list({ location: location(input), path: input.path }, request())
        return result(value.data.map((entry) => fileNode(entry, value.location.directory)))
      },
      read: async (input: Scope & { path: string }) =>
        result(
          fileView(await native.file.read({ location: location(input), path: input.path }, request()), input.path),
        ),
    },
    find: {
      files: async (
        input: Scope & { query: string; dirs?: "true" | "false"; type?: "file" | "directory"; limit?: number },
      ) =>
        result(
          (
            await native.file.find(
              {
                location: location(input),
                query: input.query,
                type: input.type ?? (input.dirs === "false" ? "file" : undefined),
                limit: input.limit,
              },
              request(),
            )
          ).data.map((entry) => entry.path),
        ),
    },
    mcp: {
      status: async (input?: Scope) =>
        result(
          Object.fromEntries(
            (await native.mcp.list({ location: location(input) }, request())).data.map((server) => [
              server.name,
              server.status,
            ]),
          ),
        ),
      connect: async (input: { name: string }) => {
        await native.mcp.connect({ server: input.name, location: location() }, request())
        return result(true)
      },
      disconnect: async (input: { name: string }) => {
        await native.mcp.disconnect({ server: input.name, location: location() }, request())
        return result(true)
      },
    },
    lsp: { status: async () => result<UI.LspStatus[]>([]) },
    vcs: {
      get: async (input?: Scope) =>
        result<UI.VcsInfo>({
          branch: (await native.vcs.get({ location: location(input) }, request())).data.branch.current,
        }),
      status: async (input?: Scope) => result((await native.vcs.status({ location: location(input) }, request())).data),
      diff: async (input: Scope & { mode: "git"; context?: number }) =>
        result(
          (await native.vcs.diff({ location: location(input), mode: "working", context: input.context }, request()))
            .data,
        ),
    },
    worktree: {
      create: async (input: Scope & { worktreeCreateInput?: { name?: string; startCommand?: string } }) => {
        const created = await native.worktree.create(
          { projectID: await resolveProject(input), name: input.worktreeCreateInput?.name },
          request(),
        )
        const vcs = await native.vcs.get({ location: { directory: created.directory } }, request())
        return result({ ...created, branch: vcs.data.branch.current ?? "" })
      },
      remove: async (input: Scope & { worktreeRemoveInput: { directory: string } }) => {
        await native.worktree.remove(
          { projectID: await resolveProject(input), directory: input.worktreeRemoveInput.directory, force: false },
          request(),
        )
        return result(true)
      },
      reset: async (_input: Scope & { worktreeResetInput: { directory: string } }): Promise<Result<boolean>> =>
        unavailable("Resetting a worktree"),
    },
    instance: {
      dispose: async (_input?: Scope & { reload?: boolean }) => {
        await native.location.reload(request())
        return result(true)
      },
    },
  }
}
