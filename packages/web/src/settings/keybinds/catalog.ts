import fuzzysort from "fuzzysort"
import { parseKeybind, type useCommand } from "@/shell/commands/command"

export const PALETTE_ID = "command.palette"

export type KeybindGroup = "General" | "Session" | "Navigation" | "Model and agent" | "Terminal" | "Prompt"

export type KeybindMeta = {
  title: string
  group: KeybindGroup
}

export type KeybindMap = Record<string, string | undefined>
type CommandContext = ReturnType<typeof useCommand>

export const GROUPS: KeybindGroup[] = ["General", "Session", "Navigation", "Model and agent", "Terminal", "Prompt"]

export function groupFor(id: string): KeybindGroup {
  if (id === PALETTE_ID) return "General"
  if (id.startsWith("terminal.")) return "Terminal"
  if (id.startsWith("model.") || id.startsWith("agent.") || id.startsWith("mcp.")) return "Model and agent"
  if (id.startsWith("file.") || id.startsWith("fileTree.")) return "Navigation"
  if (id.startsWith("prompt.")) return "Prompt"
  if (
    id.startsWith("session.") ||
    id.startsWith("message.") ||
    id.startsWith("permissions.") ||
    id.startsWith("steps.") ||
    id.startsWith("review.")
  )
    return "Session"

  return "General"
}

export function signatures(config: string | undefined) {
  if (!config) return []
  const sigs: string[] = []

  for (const kb of parseKeybind(config)) {
    const parts: string[] = []
    if (kb.ctrl) parts.push("ctrl")
    if (kb.alt) parts.push("alt")
    if (kb.shift) parts.push("shift")
    if (kb.meta) parts.push("meta")
    if (kb.key) parts.push(kb.key)
    if (parts.length === 0) continue
    sigs.push(parts.join("+"))
  }

  return sigs
}

export function keybinds(value: unknown): KeybindMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as KeybindMap
}

export function listFor(command: Pick<CommandContext, "catalog" | "options">, map: KeybindMap, palette: string) {
  const out = new Map<string, KeybindMeta>()
  out.set(PALETTE_ID, { title: palette, group: "General" })

  for (const opt of command.catalog) {
    if (opt.id.startsWith("suggested.")) continue
    if (opt.hidden) continue
    out.set(opt.id, { title: opt.title, group: groupFor(opt.id) })
  }

  for (const opt of command.options) {
    if (opt.id.startsWith("suggested.")) continue
    if (opt.hidden) continue
    out.set(opt.id, { title: opt.title, group: groupFor(opt.id) })
  }

  for (const [id, value] of Object.entries(map)) {
    if (typeof value !== "string") continue
    if (out.has(id)) continue
    out.set(id, { title: id, group: groupFor(id) })
  }

  return out
}

export function groupedFor(list: Map<string, KeybindMeta>) {
  const out = new Map<KeybindGroup, string[]>()
  for (const group of GROUPS) out.set(group, [])

  for (const [id, item] of list) {
    const ids = out.get(item.group)
    if (!ids) continue
    ids.push(id)
  }

  for (const group of GROUPS) {
    const ids = out.get(group)
    if (!ids) continue
    ids.sort((a, b) => (list.get(a)?.title ?? "").localeCompare(list.get(b)?.title ?? ""))
  }

  return out
}

export function filteredFor(
  query: string,
  list: Map<string, KeybindMeta>,
  grouped: Map<KeybindGroup, string[]>,
  keybind: (id: string) => string,
) {
  const value = query.toLowerCase().trim()
  if (!value) return grouped

  const out = new Map<KeybindGroup, string[]>()
  for (const group of GROUPS) out.set(group, [])

  const items = Array.from(list.entries()).map(([id, meta]) => ({
    id,
    title: meta.title,
    group: meta.group,
    keybind: keybind(id),
  }))

  const results = fuzzysort.go(value, items, {
    keys: ["title", "keybind"],
    threshold: -10000,
  })

  for (const result of results) {
    const ids = out.get(result.obj.group)
    if (!ids) continue
    ids.push(result.obj.id)
  }

  return out
}
