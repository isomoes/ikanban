import { createResizeObserver } from "@solid-primitives/resize-observer"
import type { FileNode } from "@opencode-ai/sdk/v2"
import { useNavigate, useParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, createSignal, For, Match, Show, Switch } from "solid-js"
import { useBrowserArchive } from "@/context/browser-archive"
import { useLocal } from "@/context/local"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useSDK } from "@/context/sdk"
import { showToast } from "@/ui/components/toast"
import { Button } from "@/ui/components/button"
import { base64Encode } from "@/util/encode"
import { parseIkanbanTaskYaml, taskStages, type IkanbanTask } from "./ikanban-task"
import { resolveNodeSessionState, type NodeSessionState } from "./session-ikanban-node-state"
import {
  getStoredNodeTaskFinished,
  getStoredNodeTaskSession,
  nodeTaskPromptPath,
  nodeTaskSessionKey,
  setStoredNodeTaskFinished,
  startNodeTaskSession,
} from "./session-ikanban-node-session"

type GraphNodeLayout = {
  id: string
  label: string
  x: number
  y: number
  node: IkanbanTask["nodes"][number]
}

type GraphEdgeLayout = {
  id: string
  from: string
  to: string
  d: string
}

type TaskLoadResult = {
  tasks: IkanbanTask[]
  invalid: string[]
}

function fileText(value: unknown) {
  if (typeof value === "string") return value
  if (!value || typeof value !== "object") return
  const record = value as { content?: unknown }
  return typeof record.content === "string" ? record.content : undefined
}

function edgePath(from: GraphNodeLayout, to: GraphNodeLayout, radius: number) {
  const startX = from.x
  const startY = from.y + radius
  const endX = to.x
  const endY = to.y - radius - 4
  const bend = Math.max(28, (endY - startY) * 0.28)
  return `M ${startX} ${startY} C ${startX} ${startY + bend}, ${endX} ${endY - bend}, ${endX} ${endY}`
}

function nodeVisualState(input: { state: NodeSessionState; active: boolean; related: boolean }) {
  const palette = (() => {
    switch (input.state) {
      case "starting":
        return {
          outer: "rgba(59,130,246,0.18)",
          fill: "rgba(59,130,246,0.18)",
          stroke: "rgba(125,211,252,0.9)",
          inner: "rgba(8,47,73,0.55)",
          text: "rgba(240,249,255,1)",
        }
      case "finish":
        return {
          outer: "rgba(34,197,94,0.16)",
          fill: "rgba(34,197,94,0.14)",
          stroke: "rgba(134,239,172,0.88)",
          inner: "rgba(20,83,45,0.55)",
          text: "rgba(240,253,244,1)",
        }
      default:
        return {
          outer: "rgba(255,255,255,0.04)",
          fill: input.related ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
          stroke: input.related ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.32)",
          inner: "rgba(17,24,39,0.48)",
          text: "rgba(255,255,255,0.92)",
        }
    }
  })()

  if (!input.active) return palette

  return {
    outer: input.state === "unstart" ? "rgba(186,230,253,0.08)" : palette.outer,
    fill: input.state === "unstart" ? "rgba(186,230,253,0.12)" : palette.fill,
    stroke: input.state === "unstart" ? "rgba(186,230,253,0.78)" : palette.stroke,
    inner: palette.inner,
    text: input.state === "unstart" ? "rgba(240,249,255,1)" : palette.text,
  }
}

async function listTaskYamlPaths(list: (path: string) => Promise<FileNode[]>, root = ".ikanban") {
  const paths: string[] = []
  const queue = [root]

  while (queue.length > 0) {
    const dir = queue.shift()
    if (!dir) continue

    let nodes: FileNode[] = []
    try {
      nodes = await list(dir)
    } catch {
      if (dir === root) return []
      continue
    }

    for (const node of nodes) {
      if (node.type === "directory") {
        queue.push(node.path)
        continue
      }
      if (node.type === "file" && node.path.endsWith("/task.yaml")) paths.push(node.path)
    }
  }

  paths.sort((a, b) => a.localeCompare(b))
  return paths
}

async function loadTasks(list: (path: string) => Promise<FileNode[]>, read: (path: string) => Promise<unknown>) {
  const invalid: string[] = []
  const tasks: IkanbanTask[] = []
  const paths = await listTaskYamlPaths(list)

  const loaded = await Promise.all(
    paths.map(async (path) => {
      try {
        const contents = await read(path)
        const parsed = parseIkanbanTaskYaml(fileText(contents) ?? "", path)
        if (!parsed) invalid.push(path)
        return parsed
      } catch {
        invalid.push(path)
        return undefined
      }
    }),
  )

  for (const task of loaded) {
    if (task) tasks.push(task)
  }

  return { tasks, invalid } satisfies TaskLoadResult
}

function GraphTask(props: {
  task: IkanbanTask
  startingNodeKey?: string
  updatingNodeKey?: string
  getStoredNodeSessionID: (taskPath: string, nodeID: string) => string | undefined
  getStoredNodeFinished: (taskPath: string, nodeID: string) => boolean
  getNodeSessionState: (taskPath: string, nodeID: string) => NodeSessionState
  onStartNodeTask: (taskPath: string, node: IkanbanTask["nodes"][number]) => void
  onToggleNodeTaskFinished: (taskPath: string, node: IkanbanTask["nodes"][number], finished: boolean) => void
}) {
  const params = useParams()
  const language = useLanguage()
  const layoutCtx = useLayout()
  const file = useFile()
  let graphRoot: HTMLDivElement | undefined
  const stages = createMemo(() => taskStages(props.task))
  const [selectedId, setSelectedId] = createSignal<string | undefined>()
  const [graphWidth, setGraphWidth] = createSignal(0)
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const tabs = createMemo(() => layoutCtx.tabs(sessionKey))
  const selectedNode = createMemo(() => props.task.nodes.find((node) => node.id === selectedId()))
  const nodeRadius = 24
  const graphNodes = createMemo<GraphNodeLayout[]>(() => {
    const width = Math.max(graphWidth(), 280)
    const margin = nodeRadius + 18
    const rowGap = 112

    return stages().flatMap((stage, stageIndex) => {
      const stageNodes = props.task.nodes.filter((node) => node.stage === stage)
      const count = stageNodes.length
      const usable = Math.max(0, width - margin * 2)
      const step = count <= 1 ? 0 : usable / (count - 1)
      const centered = margin + usable / 2

      return stageNodes.map((node, nodeIndex) => ({
        id: node.id,
        label: `${stageIndex + 1}-${nodeIndex + 1}`,
        x: count === 1 ? centered : margin + step * nodeIndex,
        y: margin + stageIndex * rowGap,
        node,
      }))
    })
  })
  const graphEdges = createMemo<GraphEdgeLayout[]>(() => {
    const lookup = new Map(graphNodes().map((item) => [item.id, item]))
    const edges: GraphEdgeLayout[] = []

    for (const item of graphNodes()) {
      for (const depId of item.node.dep_ids) {
        const source = lookup.get(depId)
        if (!source) continue
        edges.push({
          id: `${depId}:${item.id}`,
          from: depId,
          to: item.id,
          d: edgePath(source, item, nodeRadius),
        })
      }
    }

    return edges
  })
  const graphHeight = createMemo(() => {
    const rows = stages().length
    if (rows === 0) return 140
    return nodeRadius * 2 + 48 + (rows - 1) * 112
  })
  const nodeLabels = createMemo(() => {
    const labels = new Map<string, string>()
    for (const node of graphNodes()) labels.set(node.id, node.label)
    return labels
  })
  const dependencies = createMemo(() => {
    const node = selectedNode()
    if (!node) return []
    return node.dep_ids
      .map((id) => props.task.nodes.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  })
  const dependents = createMemo(() => {
    const node = selectedNode()
    if (!node) return []
    return props.task.nodes.filter((item) => item.dep_ids.includes(node.id))
  })
  const promptPath = createMemo(() => {
    const node = selectedNode()
    if (!node) return ""
    return nodeTaskPromptPath(props.task.filePath, node.id)
  })
  const selectedLabel = createMemo(() => {
    const node = selectedNode()
    if (!node) return ""
    return nodeLabels().get(node.id) ?? ""
  })
  const relatedIds = createMemo(() => {
    const node = selectedNode()
    if (!node) return new Set<string>()
    return new Set([node.id, ...node.dep_ids, ...props.task.nodes.filter((item) => item.dep_ids.includes(node.id)).map((item) => item.id)])
  })

  const openFile = (path: string) => {
    const tab = file.tab(path)
    tabs().open(tab)
    void file.load(path)
    tabs().setActive(tab)
  }

  const toggleSelectedId = (id: string) => {
    setSelectedId((current) => (current === id ? undefined : id))
  }

  const detail = createMemo(() => {
    const node = selectedNode()
    if (!node) return null

    return {
      node,
      label: selectedLabel(),
      sessionID: props.getStoredNodeSessionID(props.task.filePath, node.id),
      finished: props.getStoredNodeFinished(props.task.filePath, node.id),
      dependencies: dependencies().map((item) => ({
        id: item.id,
        label: nodeLabels().get(item.id) ?? item.id,
        name: item.name,
      })),
      dependents: dependents().map((item) => ({
        id: item.id,
        label: nodeLabels().get(item.id) ?? item.id,
        name: item.name,
      })),
    }
  })

  createResizeObserver(
    () => graphRoot,
    ({ width }) => {
      const next = Math.max(280, Math.floor(width))
      if (next !== graphWidth()) setGraphWidth(next)
    },
  )

  createEffect(() => {
    const el = graphRoot
    if (!el) return
    const next = Math.max(280, Math.floor(el.getBoundingClientRect().width))
    if (next !== graphWidth()) setGraphWidth(next)
  })

  return (
    <section class="rounded-xl border border-border-weak-base bg-background-base/70 p-4">
      <div class="flex items-start justify-between gap-3 pb-4">
        <div class="min-w-0">
          <div class="text-14-medium text-text-strong truncate">{props.task.name}</div>
          <div class="pt-1 text-12-regular text-text-weak">{props.task.description}</div>
        </div>
        <Button size="small" variant="secondary" class="shrink-0" onClick={() => openFile(props.task.filePath)}>
          {props.task.id}
        </Button>
      </div>

      <div class="w-full">
        <div class="w-full">
          <div ref={graphRoot} class="w-full rounded-xl border border-border-weak-base bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05),_transparent_55%)] p-3">
            <svg viewBox={`0 0 ${Math.max(graphWidth(), 280)} ${graphHeight()}`} class="block h-auto w-full overflow-visible">
              <defs>
                <marker id={`graph-arrow-${props.task.id}`} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="rgba(255,255,255,0.65)" />
                </marker>
                <marker id={`graph-arrow-active-${props.task.id}`} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="rgba(186,230,253,0.95)" />
                </marker>
              </defs>

              <g>
                <For each={graphEdges()}>
                  {(edge) => {
                    const active = () => edge.from === selectedId() || edge.to === selectedId()
                    const related = () => relatedIds().has(edge.from) && relatedIds().has(edge.to)

                    return (
                      <path
                        d={edge.d}
                        fill="none"
                        stroke={active() ? "rgba(186,230,253,0.95)" : related() ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.28)"}
                        stroke-width={active() ? "2.8" : related() ? "2.1" : "1.6"}
                        stroke-linecap="round"
                        marker-end={active() ? `url(#graph-arrow-active-${props.task.id})` : `url(#graph-arrow-${props.task.id})`}
                      />
                    )
                  }}
                </For>
              </g>

              <g>
                <For each={graphNodes()}>
                  {(item) => {
                    const active = () => selectedId() === item.id
                    const related = () => relatedIds().has(item.id)
                    const state = () => props.getNodeSessionState(props.task.filePath, item.id)
                    const visual = () => nodeVisualState({ state: state(), active: active(), related: related() })

                    return (
                    <g
                      transform={`translate(${item.x}, ${item.y})`}
                      class="cursor-pointer"
                        onClick={() => toggleSelectedId(item.id)}
                      >
                        <circle
                          r={nodeRadius + 5}
                          fill={visual().outer}
                          stroke="none"
                        />
                        <circle
                          r={nodeRadius}
                          fill={visual().fill}
                          stroke={visual().stroke}
                          stroke-width={active() ? "2.2" : "2"}
                        />
                        <circle
                          r={nodeRadius - 4}
                          fill={visual().inner}
                          stroke={active() ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.14)"}
                          stroke-width="1"
                        />
                        <text
                          text-anchor="middle"
                          dominant-baseline="middle"
                          fill={visual().text}
                          class="select-none"
                          style={{ "font-size": "13px", "font-weight": active() ? "700" : "600" }}
                        >
                          {item.label}
                        </text>
                      </g>
                    )
                  }}
                </For>
              </g>
            </svg>
          </div>
        </div>
      </div>

      <Show when={detail()}>
        {(selected) => (
          <div class="mt-3 rounded-xl border border-border-weak-base bg-background-base/95 p-4 shadow-xl backdrop-blur-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-14-medium text-text-strong">{selected().node.name}</div>
              </div>
              <div class="flex items-center gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={
                    props.startingNodeKey === nodeTaskSessionKey(props.task.filePath, selected().node.id) ||
                    props.updatingNodeKey === nodeTaskSessionKey(props.task.filePath, selected().node.id)
                  }
                  onClick={() => props.onStartNodeTask(props.task.filePath, selected().node)}
                >
                  {props.startingNodeKey === nodeTaskSessionKey(props.task.filePath, selected().node.id)
                    ? language.t("session.ikanban.node.starting")
                    : selected().sessionID
                      ? language.t("session.ikanban.node.openSession")
                      : language.t("session.ikanban.node.start")}
                </Button>
                <Show when={selected().sessionID}>
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={props.updatingNodeKey === nodeTaskSessionKey(props.task.filePath, selected().node.id)}
                    onClick={() => props.onToggleNodeTaskFinished(props.task.filePath, selected().node, !selected().finished)}
                  >
                    {selected().finished ? language.t("session.ikanban.node.back") : language.t("session.ikanban.node.finish")}
                  </Button>
                </Show>
                <Button size="small" variant="secondary" onClick={() => openFile(promptPath())}>
                  {selected().label}
                </Button>
              </div>
            </div>

            <div class="pt-3 text-13-regular text-text-base">{selected().node.description}</div>

            <div class="grid gap-4 pt-4 md:grid-cols-2">
              <div>
                <div class="pb-2 text-12-medium uppercase tracking-[0.08em] text-text-weak">Depends on</div>
                <Show when={selected().dependencies.length > 0} fallback={<div class="text-12-regular text-text-weak">No dependencies.</div>}>
                  <div class="flex flex-wrap gap-2">
                    <For each={selected().dependencies}>
                      {(dependency) => (
                        <div class="rounded-md border border-border-weak-base bg-background-stronger px-2 py-1 text-12-regular text-text-base">
                          {dependency.label} {dependency.name}
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <div>
                <div class="pb-2 text-12-medium uppercase tracking-[0.08em] text-text-weak">Required for</div>
                <Show when={selected().dependents.length > 0} fallback={<div class="text-12-regular text-text-weak">No downstream nodes.</div>}>
                  <div class="flex flex-wrap gap-2">
                    <For each={selected().dependents}>
                      {(dependent) => (
                        <div class="rounded-md border border-border-weak-base bg-background-stronger px-2 py-1 text-12-regular text-text-base">
                          {dependent.label} {dependent.name}
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        )}
      </Show>
    </section>
  )
}

export function SessionIkanbanPane() {
  const navigate = useNavigate()
  const sdk = useSDK()
  const browserArchive = useBrowserArchive()
  const local = useLocal()
  const language = useLanguage()
  const layout = useLayout()
  const [startingNodeKey, setStartingNodeKey] = createSignal<string | undefined>()
  const [updatingNodeKey, setUpdatingNodeKey] = createSignal<string | undefined>()
  const [storageRevision, setStorageRevision] = createSignal(0)
  const [tasks] = createResource(
    () => sdk.directory,
    () =>
      loadTasks(
        (path) => sdk.client.file.list({ path }).then((result) => result.data ?? []),
        (path) => sdk.client.file.read({ path }).then((result) => result.data),
      ),
  )

  const validTasks = createMemo(() => tasks()?.tasks ?? [])
  const invalidPaths = createMemo(() => tasks()?.invalid ?? [])

  const errorMessage = (err: unknown) => {
    if (err && typeof err === "object" && "data" in err) {
      const data = (err as { data?: { message?: string } }).data
      if (data?.message) return data.message
    }
    if (err instanceof Error) return err.message
    return language.t("common.requestFailed")
  }

  const storedNodeSessionID = (taskPath: string, nodeID: string) => {
    storageRevision()
    if (typeof localStorage === "undefined") return undefined
    return getStoredNodeTaskSession(localStorage, sdk.directory, taskPath, nodeID)
  }

  const storedNodeFinished = (taskPath: string, nodeID: string) => {
    storageRevision()
    if (typeof localStorage === "undefined") return false
    return getStoredNodeTaskFinished(localStorage, sdk.directory, taskPath, nodeID)
  }

  const nodeSessionState = (taskPath: string, nodeID: string) => {
    const sessionID = storedNodeSessionID(taskPath, nodeID)
    return resolveNodeSessionState({
      sessionID,
      finished: storedNodeFinished(taskPath, nodeID),
    })
  }

  const bumpStorageRevision = () => {
    setStorageRevision((value) => value + 1)
  }

  const navigateToSession = (sessionID: string) => {
    const slug = base64Encode(sdk.directory)
    layout.handoff.setTabs(slug, sessionID)
    navigate(`/${slug}/${sessionID}`)
  }

  const startNodeTask = async (taskPath: string, node: IkanbanTask["nodes"][number]) => {
    if (typeof localStorage === "undefined") {
      showToast({
        title: language.t("session.ikanban.node.startFailed.title"),
        description: language.t("common.requestFailed"),
      })
      return
    }

    const currentModel = local.model.current()
    const currentAgent = local.agent.current()
    if (!currentModel || !currentAgent) {
      showToast({
        title: language.t("prompt.toast.modelAgentRequired.title"),
        description: language.t("prompt.toast.modelAgentRequired.description"),
      })
      return
    }

    const activeKey = nodeTaskSessionKey(taskPath, node.id)
    if (startingNodeKey() === activeKey) return

    setStartingNodeKey(activeKey)

    try {
      await startNodeTaskSession({
        storage: localStorage,
        directory: sdk.directory,
        taskPath,
        nodeID: node.id,
        agent: currentAgent.name,
        model: { providerID: currentModel.provider.id, modelID: currentModel.id },
        variant: local.model.variant.current(),
        readPrompt: async (path) => fileText(await sdk.client.file.read({ path }).then((result) => result.data)) ?? "",
        createSession: async () => {
          const session = await sdk.client.session.create().then((result) => result.data)
          if (!session) throw new Error(language.t("common.requestFailed"))
          return session
        },
        promptSession: (input) => sdk.client.session.promptAsync(input).then(() => undefined),
        navigateToSession,
      })
      bumpStorageRevision()
    } catch (err) {
      showToast({
        title: language.t("session.ikanban.node.startFailed.title"),
        description: errorMessage(err),
      })
    } finally {
      setStartingNodeKey(undefined)
    }
  }

  const toggleNodeTaskFinished = async (taskPath: string, node: IkanbanTask["nodes"][number], finished: boolean) => {
    if (typeof localStorage === "undefined") {
      showToast({
        title: language.t("session.ikanban.node.updateFailed.title"),
        description: language.t("common.requestFailed"),
      })
      return
    }

    const sessionID = getStoredNodeTaskSession(localStorage, sdk.directory, taskPath, node.id)
    if (!sessionID) return

    const activeKey = nodeTaskSessionKey(taskPath, node.id)
    if (updatingNodeKey() === activeKey) return

    setUpdatingNodeKey(activeKey)

    try {
      if (finished) browserArchive.archiveSession({ directory: sdk.directory, sessionID })
      else browserArchive.unarchiveSession({ directory: sdk.directory, sessionID })
      setStoredNodeTaskFinished(localStorage, sdk.directory, taskPath, node.id, finished)
      bumpStorageRevision()
    } catch (err) {
      showToast({
        title: language.t("session.ikanban.node.updateFailed.title"),
        description: errorMessage(err),
      })
    } finally {
      setUpdatingNodeKey(undefined)
    }
  }

  return (
    <div class="flex h-full min-h-0 flex-col overflow-hidden bg-background-stronger contain-strict">
      <div class="flex-1 min-h-0 overflow-auto px-4 py-4">
        <Switch>
          <Match when={tasks.loading && validTasks().length === 0}>
            <div class="px-2 py-3 text-14-regular text-text-weak">{language.t("session.ikanban.loading")}</div>
          </Match>
          <Match when={validTasks().length > 0}>
            <div class="flex flex-col gap-4">
              <Show when={invalidPaths().length > 0}>
                <div class="rounded-lg border border-border-weak-base bg-background-base/70 px-3 py-2 text-12-regular text-text-weak">
                  {language.t("session.ikanban.invalid", { count: invalidPaths().length })}
                </div>
              </Show>
              <For each={validTasks()}>
                {(task) => (
                  <GraphTask
                    task={task}
                    startingNodeKey={startingNodeKey()}
                    updatingNodeKey={updatingNodeKey()}
                    getStoredNodeSessionID={storedNodeSessionID}
                    getStoredNodeFinished={storedNodeFinished}
                    getNodeSessionState={nodeSessionState}
                    onStartNodeTask={(taskPath, node) => {
                      void startNodeTask(taskPath, node)
                    }}
                    onToggleNodeTaskFinished={(taskPath, node, finished) => {
                      void toggleNodeTaskFinished(taskPath, node, finished)
                    }}
                  />
                )}
              </For>
            </div>
          </Match>
          <Match when={true}>
            <div class="flex h-full min-h-0 items-center justify-center px-6 py-8 text-center">
              <div class="max-w-md rounded-xl border border-dashed border-border-weak-base bg-background-base/40 px-5 py-8">
                <div class="text-14-medium text-text-strong">{language.t("session.ikanban.empty.title")}</div>
                <div class="pt-2 text-14-regular text-text-weak">{language.t("session.ikanban.empty.description")}</div>
              </div>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  )
}
