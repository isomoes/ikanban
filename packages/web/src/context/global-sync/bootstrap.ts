import type {
  ConfigEntry,
  IntegrationInfo,
  McpServer,
  ModelInfo,
  OpenCodeClient,
  PermissionRequest,
  Project,
  ProviderInfo,
  QuestionRequest,
} from "@opencode-ai/client"
import type { RuntimeLocations, TodoItem } from "@/types/app"
import { showToast } from "@/ui/components/toast"
import { getFilename } from "@/utils/path"
import { retry } from "@/utils/retry"
import { batch } from "solid-js"
import { reconcile, type SetStoreFunction, type Store } from "solid-js/store"
import type { State, VcsCache } from "./types"
import { cmp } from "./utils"
import { formatServerError } from "@/utils/server-errors"

const location = (directory: string) => ({ location: { directory } })

function toPath(info: Awaited<ReturnType<OpenCodeClient["location"]["get"]>>): RuntimeLocations {
  return {
    home: "",
    canonical: info.project.canonical,
    directory: info.directory,
  }
}

function toMcp(servers: McpServer[]): Record<string, McpServer["status"]> {
  return Object.fromEntries(servers.map((server) => [server.name, server.status]))
}

async function providerState(client: OpenCodeClient, directory?: string) {
  const scope = directory ? location(directory) : undefined
  const [providers, models, integrations, defaultModel] = await Promise.all([
    client.provider.list(scope),
    client.model.list(scope),
    client.integration.list(scope),
    client.model.default(scope),
  ])
  return {
    providers: providers.data,
    models: models.data.filter((model) => model.status !== "deprecated"),
    integrations: integrations.data,
    defaultModel: defaultModel.data,
  }
}

type GlobalStore = {
  ready: boolean
  path: RuntimeLocations
  project: Project[]
  session_todo: {
    [sessionID: string]: TodoItem[]
  }
  provider: {
    providers: ProviderInfo[]
    models: ModelInfo[]
    integrations: IntegrationInfo[]
    defaultModel: ModelInfo | null
  }
  config: ConfigEntry[]
  reload: undefined | "pending" | "complete"
}

export async function bootstrapGlobal(input: {
  globalSDK: OpenCodeClient
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
        input.setGlobalStore("config", entries)
      }),
    ),
    retry(() =>
      providerState(input.globalSDK).then((state) => {
        input.setGlobalStore("provider", state)
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
            .filter((p) => !!p.canonical && !p.canonical.includes("opencode-test"))
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
  sdk: OpenCodeClient
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
        input.setStore("provider", state)
      }),
    agent: () => input.sdk.agent.list(scope).then((x) => input.setStore("agent", x.data)),
    config: () => input.sdk.config.get(scope).then((entries) => input.setStore("config", entries)),
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
    input.sdk.command.list(scope).then((x) => input.setStore("command", x.data)),
    input.sdk.session.active().then((sessions) =>
      input.setStore(
        "session_status",
        Object.fromEntries(Object.keys(sessions).map((sessionID) => [sessionID, { type: "busy" as const }])),
      ),
    ),
    input.loadSessions(input.directory),
    input.sdk.mcp.list(scope).then((x) => input.setStore("mcp", toMcp(x.data))),
    input.sdk.vcs.get(scope).then((x) => {
      input.setStore("vcs", x.data)
      if (x.data.branch.current) input.vcsCache.setStore("value", x.data)
    }),
    input.sdk.permission.request.list(scope).then((x) => {
      const grouped = groupBySession(
        x.data.filter((perm) => !!perm?.id && !!perm.sessionID),
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
