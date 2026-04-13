export type IkanbanTaskNode = {
  id: string
  dep_ids: string[]
  name: string
  description: string
  stage: string
}

export type IkanbanTask = {
  id: string
  name: string
  description: string
  filePath: string
  nodes: IkanbanTaskNode[]
}

function readScalar(raw: string | undefined) {
  const value = raw?.trim()
  if (!value) return ""
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value
}

function readList(raw: string | undefined) {
  const value = raw?.trim()
  if (!value || value === "[]") return []
  if (!value.startsWith("[") || !value.endsWith("]")) return []

  return value
    .slice(1, -1)
    .split(",")
    .map((item) => readScalar(item))
    .filter(Boolean)
}

export function parseIkanbanTaskYaml(source: string, filePath: string): IkanbanTask | undefined {
  const lines = source.split(/\r?\n/)

  let id = ""
  let name = ""
  let description = ""
  let inNodes = false
  const nodes: IkanbanTaskNode[] = []
  let current: Partial<IkanbanTaskNode> | undefined

  for (const line of lines) {
    if (!inNodes) {
      const taskMatch = line.match(/^task:\s*$/)
      if (taskMatch) continue

      const topMatch = line.match(/^  (id|name|description|nodes):\s*(.*)$/)
      if (!topMatch) continue

      const [, key, raw] = topMatch
      if (key === "id") id = readScalar(raw)
      if (key === "name") name = readScalar(raw)
      if (key === "description") description = readScalar(raw)
      if (key === "nodes") inNodes = true
      continue
    }

    const nodeMatch = line.match(/^    - id:\s*(.+)$/)
    if (nodeMatch) {
      if (current?.id && current.name && current.description && current.stage && current.dep_ids) {
        nodes.push(current as IkanbanTaskNode)
      }

      current = {
        id: readScalar(nodeMatch[1]),
        dep_ids: [],
        name: "",
        description: "",
        stage: "",
      }
      continue
    }

    const fieldMatch = line.match(/^      (dep_ids|name|description|stage):\s*(.*)$/)
    if (!fieldMatch || !current) continue

    const [, key, raw] = fieldMatch
    if (key === "dep_ids") current.dep_ids = readList(raw)
    if (key === "name") current.name = readScalar(raw)
    if (key === "description") current.description = readScalar(raw)
    if (key === "stage") current.stage = readScalar(raw)
  }

  if (current?.id && current.name && current.description && current.stage && current.dep_ids) {
    nodes.push(current as IkanbanTaskNode)
  }

  if (!id || !name || !description || nodes.length === 0) return

  const ids = new Set<string>()
  for (const node of nodes) {
    if (!node.id || ids.has(node.id)) return
    ids.add(node.id)
  }

  for (const node of nodes) {
    if (node.dep_ids.some((dep) => !ids.has(dep) || dep === node.id)) return
  }

  return { id, name, description, filePath, nodes }
}

export function taskStages(task: IkanbanTask) {
  const stages: string[] = []
  for (const node of task.nodes) {
    if (stages.includes(node.stage)) continue
    stages.push(node.stage)
  }
  return stages
}
