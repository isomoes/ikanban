import type {
  Agent,
  Command,
  Config,
  McpStatus,
  Model,
  OpencodeClient,
  Path,
  PermissionRequest,
  Project,
  Provider,
  ProviderAuthMethod,
  ProviderAuthResponse,
  ProviderListResponse,
  QuestionRequest,
  Todo,
} from "@/types/opencode"
import type {
  AgentInfo,
  ConfigEntry,
  IntegrationInfo,
  McpServer,
  ModelInfo,
  PermissionRequest as NativePermissionRequest,
  Project as NativeProject,
  ProviderInfo,
} from "@opencode-ai/client"
import { showToast } from "@/ui/components/toast"
import { getFilename } from "@/utils/path"
import { retry } from "@/utils/retry"
import { batch } from "solid-js"
import { reconcile, type SetStoreFunction, type Store } from "solid-js/store"
import type { State, VcsCache } from "./types"
import { cmp, normalizeProviderList } from "./utils"
import { formatServerError } from "@/utils/server-errors"

const location = (directory: string) => ({ location: { directory } })

function toPath(info: Awaited<ReturnType<OpencodeClient["location"]["get"]>>): Path {
  return {
    home: "",
    state: "",
    config: "",
    worktree: info.project.canonical,
    directory: info.directory,
  }
}

function toProject(project: NativeProject): Project {
  return {
    id: project.id,
    worktree: project.canonical,
    vcs: project.vcs,
    name: project.name,
    icon: project.icon,
    commands: project.commands,
    time: project.time,
    sandboxes: project.sandboxes,
  }
}

function toConfig(entries: ConfigEntry[]): Config {
  const documents = entries.filter((entry): entry is Extract<ConfigEntry, { type: "document" }> => entry.type === "document")
  const info: Extract<ConfigEntry, { type: "document" }>["info"] = Object.assign(
    {},
    ...documents.map((entry) => entry.info),
  )
  const permissions = info.permissions?.reduce<Record<string, Record<string, string>>>((result, rule) => {
    result[rule.action] = { ...result[rule.action], [rule.resource]: rule.effect }
    return result
  }, {})
  const model = typeof info.model === "string" ? info.model : info.model && `${info.model.providerID}/${info.model.model}`

  return {
    ...info,
    model,
    permission: permissions,
    plugin: info.plugins,
    provider: info.providers,
  }
}

function toModel(model: ModelInfo): Model {
  const cost = model.cost.find((item) => !item.tier) ?? model.cost[0]
  return {
    id: model.id,
    providerID: model.providerID,
    name: model.name,
    family: model.family,
    capabilities: {
      temperature: true,
      reasoning: model.capabilities.output.includes("reasoning"),
      attachment: model.capabilities.input.some((item) => item !== "text"),
      toolcall: model.capabilities.tools,
      input: Object.fromEntries(model.capabilities.input.map((item) => [item, true])),
      output: Object.fromEntries(model.capabilities.output.map((item) => [item, true])),
      interleaved: false,
    },
    cost: cost ?? { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: model.limit,
    status: model.status,
    variants: Object.fromEntries(model.variants.map((variant) => [variant.id, variant.settings ?? {}])),
  }
}

function toProviderList(
  providers: ProviderInfo[],
  models: ModelInfo[],
  integrations: IntegrationInfo[],
  defaultModel: ModelInfo | null,
): ProviderListResponse {
  const modelsByProvider = models.reduce<Map<string, ModelInfo[]>>((result, model) => {
    const items = result.get(model.providerID)
    if (items) items.push(model)
    if (!items) result.set(model.providerID, [model])
    return result
  }, new Map())
  const integrationByID = new Map(integrations.map((integration) => [integration.id, integration]))
  const all: Provider[] = providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    source: "custom",
    env: [],
    options: provider.settings ?? {},
    models: Object.fromEntries((modelsByProvider.get(provider.id) ?? []).map((model) => [model.id, toModel(model)])),
  }))
  return normalizeProviderList({
    all,
    connected: providers
      .filter((provider) => provider.integrationID && integrationByID.get(provider.integrationID)?.connections.length)
      .map((provider) => provider.id),
    default: defaultModel ? { [defaultModel.providerID]: defaultModel.id } : {},
  })
}

function toProviderAuth(providers: ProviderInfo[], integrations: IntegrationInfo[]): ProviderAuthResponse {
  const integrationByID = new Map(integrations.map((integration) => [integration.id, integration]))
  const result: ProviderAuthResponse = {}
  for (const provider of providers) {
    const integration = provider.integrationID && integrationByID.get(provider.integrationID)
    if (!integration) continue
    const methods: ProviderAuthMethod[] = []
    for (const method of integration.methods) {
      if (method.type === "oauth") {
        methods.push({ type: "oauth", label: method.label, prompts: method.form?.map((field) => ({ ...field })) })
      }
      if (method.type === "key") {
        methods.push({ type: "api", label: method.label ?? "API key", prompts: method.form?.map((field) => ({ ...field })) })
      }
    }
    if (methods.length) result[provider.id] = methods
  }
  return result
}

function toAgent(agent: AgentInfo): Agent {
  return {
    name: agent.id,
    description: agent.description,
    mode: agent.mode,
    hidden: agent.hidden,
    color: agent.color,
    permission: agent.permissions.map((rule) => ({
      permission: rule.action,
      pattern: rule.resource,
      action: rule.effect,
    })),
    model: agent.model && { modelID: agent.model.id, providerID: agent.model.providerID },
    variant: agent.model?.variant,
    options: agent.request.settings,
    steps: agent.steps,
  }
}

function toCommand(command: Awaited<ReturnType<OpencodeClient["command"]["list"]>>["data"][number]): Command {
  return {
    ...command,
    model: command.model && `${command.model.providerID}/${command.model.id}`,
    source: "command",
    hints: [],
  }
}

function toMcp(servers: McpServer[]): Record<string, McpStatus> {
  return Object.fromEntries(
    servers.map((server) => [
      server.name,
      server.status.status === "pending" ? { status: "failed" as const, error: "Connection pending" } : server.status,
    ]),
  )
}

function toPermission(request: NativePermissionRequest): PermissionRequest {
  return {
    id: request.id,
    sessionID: request.sessionID,
    permission: request.action,
    patterns: request.resources,
    metadata: request.metadata ?? {},
    always: request.save ?? [],
    tool: request.source && { messageID: request.source.messageID, callID: request.source.id },
  }
}

async function providerState(client: OpencodeClient, directory?: string) {
  const scope = directory ? location(directory) : undefined
  const [providers, models, integrations, defaultModel] = await Promise.all([
    client.provider.list(scope),
    client.model.list(scope),
    client.integration.list(scope),
    client.model.default(scope),
  ])
  return {
    list: toProviderList(providers.data, models.data, integrations.data, defaultModel.data),
    auth: toProviderAuth(providers.data, integrations.data),
  }
}

type GlobalStore = {
  ready: boolean
  path: Path
  project: Project[]
  session_todo: {
    [sessionID: string]: Todo[]
  }
  provider: ProviderListResponse
  provider_auth: ProviderAuthResponse
  config: Config
  reload: undefined | "pending" | "complete"
}

export async function bootstrapGlobal(input: {
  globalSDK: OpencodeClient
  connectErrorTitle: string
  connectErrorDescription: string
  requestFailedTitle: string
  unknownError: string
  invalidConfigurationError: string
  formatMoreCount: (count: number) => string
  loadProjects?: boolean
  setGlobalStore: SetStoreFunction<GlobalStore>
}) {
  const health = await input.globalSDK.health.get().catch(() => undefined)
  if (!health?.healthy) {
    showToast({
      variant: "error",
      title: input.connectErrorTitle,
      description: input.connectErrorDescription,
    })
    input.setGlobalStore("ready", true)
    return
  }

  const tasks = [
    retry(() =>
      input.globalSDK.location.get().then((info) => {
        input.setGlobalStore("path", toPath(info))
      }),
    ),
    retry(() =>
      input.globalSDK.config.get().then((entries) => {
        input.setGlobalStore("config", toConfig(entries))
      }),
    ),
    retry(() =>
      providerState(input.globalSDK).then((state) => {
        input.setGlobalStore("provider", state.list)
        input.setGlobalStore("provider_auth", state.auth)
      }),
    ),
  ]

  if (input.loadProjects !== false) {
    tasks.splice(
      2,
      0,
      retry(() =>
        input.globalSDK.project.list().then((x) => {
          const projects = x
            .filter((p) => !!p?.id)
            .map(toProject)
            .filter((p) => !!p.worktree && !p.worktree.includes("opencode-test"))
            .slice()
            .sort((a, b) => cmp(a.id, b.id))
          input.setGlobalStore("project", projects)
        }),
      ),
    )
  }

  const results = await Promise.allSettled(tasks)
  const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => r.reason)
  if (errors.length) {
    const message = formatServerError(errors[0], {
      unknown: input.unknownError,
      invalidConfiguration: input.invalidConfigurationError,
    })
    const more = errors.length > 1 ? input.formatMoreCount(errors.length - 1) : ""
    showToast({
      variant: "error",
      title: input.requestFailedTitle,
      description: message + more,
    })
  }
  input.setGlobalStore("ready", true)
}

function groupBySession<T extends { id: string; sessionID: string }>(input: T[]) {
  return input.reduce<Record<string, T[]>>((acc, item) => {
    if (!item?.id || !item.sessionID) return acc
    const list = acc[item.sessionID]
    if (list) list.push(item)
    if (!list) acc[item.sessionID] = [item]
    return acc
  }, {})
}

export async function bootstrapDirectory(input: {
  directory: string
  sdk: OpencodeClient
  store: Store<State>
  setStore: SetStoreFunction<State>
  vcsCache: VcsCache
  loadSessions: (directory: string) => Promise<void> | void
  unknownError: string
  invalidConfigurationError: string
}) {
  if (input.store.status !== "complete") input.setStore("status", "loading")
  const scope = location(input.directory)

  const blockingRequests = {
    project: () => input.sdk.project.current(scope).then((project) => input.setStore("project", project.id)),
    provider: () =>
      providerState(input.sdk, input.directory).then((state) => {
        input.setStore("provider", state.list)
      }),
    agent: () => input.sdk.agent.list(scope).then((x) => input.setStore("agent", x.data.map(toAgent))),
    config: () => input.sdk.config.get(scope).then((entries) => input.setStore("config", toConfig(entries))),
  }

  try {
    await Promise.all(Object.values(blockingRequests).map((p) => retry(p)))
  } catch (err) {
    console.error("Failed to bootstrap instance", err)
    const project = getFilename(input.directory)
    showToast({
      variant: "error",
      title: `Failed to reload ${project}`,
      description: formatServerError(err, {
        unknown: input.unknownError,
        invalidConfiguration: input.invalidConfigurationError,
      }),
    })
    input.setStore("status", "partial")
    return
  }

  if (input.store.status !== "complete") input.setStore("status", "partial")

  Promise.all([
    input.sdk.location.get(scope).then((info) => input.setStore("path", toPath(info))),
    input.sdk.command.list(scope).then((x) => input.setStore("command", x.data.map(toCommand))),
    input.sdk.session.active().then((sessions) =>
      input.setStore(
        "session_status",
        Object.fromEntries(Object.keys(sessions).map((sessionID) => [sessionID, { type: "busy" as const }])),
      ),
    ),
    input.loadSessions(input.directory),
    input.sdk.mcp.list(scope).then((x) => input.setStore("mcp", toMcp(x.data))),
    input.sdk.vcs.get(scope).then((x) => {
      const next = { branch: x.data.branch.current, default_branch: x.data.branch.default }
      input.setStore("vcs", next)
      if (next?.branch) input.vcsCache.setStore("value", next)
    }),
    input.sdk.permission.request.list(scope).then((x) => {
      const grouped = groupBySession(
        x.data.filter((perm) => !!perm?.id && !!perm.sessionID).map(toPermission),
      )
      batch(() => {
        for (const sessionID of Object.keys(input.store.permission)) {
          if (grouped[sessionID]) continue
          input.setStore("permission", sessionID, [])
        }
        for (const [sessionID, permissions] of Object.entries(grouped)) {
          input.setStore(
            "permission",
            sessionID,
            reconcile(
              permissions.filter((p) => !!p?.id).sort((a, b) => cmp(a.id, b.id)),
              { key: "id" },
            ),
          )
        }
      })
    }),
    input.sdk.question.request.list(scope).then((x) => {
      const grouped = groupBySession(x.data.filter((q): q is QuestionRequest => !!q?.id && !!q.sessionID))
      batch(() => {
        for (const sessionID of Object.keys(input.store.question)) {
          if (grouped[sessionID]) continue
          input.setStore("question", sessionID, [])
        }
        for (const [sessionID, questions] of Object.entries(grouped)) {
          input.setStore(
            "question",
            sessionID,
            reconcile(
              questions.filter((q) => !!q?.id).sort((a, b) => cmp(a.id, b.id)),
              { key: "id" },
            ),
          )
        }
      })
    }),
  ]).then(() => {
    input.setStore("status", "complete")
  })
}
