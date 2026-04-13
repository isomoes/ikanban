import { createResizeObserver } from "@solid-primitives/resize-observer"
import type { FileNode } from "@opencode-ai/sdk/v2"
import { useParams } from "@solidjs/router"
import { createEffect, createMemo, createResource, createSignal, For, Match, Show, Switch } from "solid-js"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useSDK } from "@/context/sdk"
import { Button } from "@/ui/components/button"
import { parseIkanbanTaskYaml, taskStages, type IkanbanTask, type IkanbanTaskNode } from "./ikanban-task"

export type IkanbanNodeDetail = {
  taskId: string
  taskName: string
  taskPath: string
  node: IkanbanTaskNode
  label: string
  promptPath: string
  dependencies: Array<{ id: string; label: string; name: string }>
  dependents: Array<{ id: string; label: string; name: string }>
}

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

function GraphTask(props: { task: IkanbanTask; onDetailChange?: (detail: IkanbanNodeDetail | null) => void }) {
  const params = useParams()
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
    return props.task.filePath.replace(/\/task\.yaml$/, `/${node.id}.md`)
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

  const detail = createMemo<IkanbanNodeDetail | null>(() => {
    const node = selectedNode()
    if (!node) return null

    return {
      taskId: props.task.id,
      taskName: props.task.name,
      taskPath: props.task.filePath,
      node,
      label: selectedLabel(),
      promptPath: promptPath(),
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

  createEffect(() => {
    props.onDetailChange?.(detail())
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

                    return (
                    <g
                      transform={`translate(${item.x}, ${item.y})`}
                      class="cursor-pointer"
                        onClick={() => toggleSelectedId(item.id)}
                      >
                        <circle
                          r={nodeRadius + 5}
                          fill={active() ? "rgba(186,230,253,0.08)" : "rgba(255,255,255,0.04)"}
                          stroke="none"
                        />
                        <circle
                          r={nodeRadius}
                          fill={active() ? "rgba(186,230,253,0.12)" : related() ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)"}
                          stroke={active() ? "rgba(186,230,253,0.78)" : related() ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.32)"}
                          stroke-width={active() ? "2.2" : "2"}
                        />
                        <circle
                          r={nodeRadius - 4}
                          fill="rgba(17,24,39,0.48)"
                          stroke={active() ? "rgba(186,230,253,0.3)" : "rgba(255,255,255,0.18)"}
                          stroke-width="1"
                        />
                        <text
                          text-anchor="middle"
                          dominant-baseline="middle"
                          fill={active() ? "rgba(240,249,255,1)" : "rgba(255,255,255,0.92)"}
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
          <div class="pt-3 text-center text-12-regular text-text-weak">Click a node to inspect its details.</div>
        </div>
      </div>

      <div class="pt-3 text-12-regular text-text-weak">{props.task.filePath}</div>
    </section>
  )
}

export function SessionIkanbanPane(props: { onDetailChange?: (detail: IkanbanNodeDetail | null) => void }) {
  const sdk = useSDK()
  const language = useLanguage()
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
              <For each={validTasks()}>{(task) => <GraphTask task={task} onDetailChange={props.onDetailChange} />}</For>
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
