import type { ConfigEntry, OpenCodeClient } from "@opencode/client"
import { applyEdits, modify, parseTree, type ParseError } from "jsonc-parser"
import type { Config } from "./types"

export function mergeConfig(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const existing = target[key]
      const next = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {}
      mergeConfig(next, value as Record<string, unknown>)
      target[key] = next
    } else target[key] = value
  }
}

export function patchConfig(text: string, patch: Config): string {
  const errors: ParseError[] = []
  const tree = parseTree(text, errors, { allowTrailingComma: true })
  if (errors.length || tree?.type !== "object")
    throw new Error("The server configuration is not a valid JSON/JSONC object")
  const write = (value: unknown, path: string[]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) write(child, [...path, key])
      return
    }
    text = applyEdits(text, modify(text, path, value, { formattingOptions: { insertSpaces: true, tabSize: 2 } }))
  }
  write(patch, [])
  return text
}

/** Only edit an existing global document identified by the server, never a guessed home path. */
export function globalConfigPath(entries: ConfigEntry[]): string {
  const root = entries.find((entry) => entry.type === "directory")?.path
  const documents = entries.filter(
    (entry) => entry.type === "document" && entry.path && root && entry.path.replace(/[\\/][^\\/]+$/, "") === root,
  )
  const path = documents.at(-1)?.path
  if (!path)
    throw new Error(
      "Create a global opencode.json or opencode.jsonc on the OpenCode server before editing settings here",
    )
  return path
}

export async function updateServerConfig(client: OpenCodeClient, patch: Config, signal?: AbortSignal) {
  const entries = await client.config.get(undefined, { signal })
  const path = globalConfigPath(entries)
  const original = new TextDecoder().decode(await client.file.read({ path }, { signal }))
  const updated = patchConfig(original, patch)
  await client.file.write({ path, payload: new TextEncoder().encode(updated) }, { signal })
  await client.location.reload({ signal })
}
