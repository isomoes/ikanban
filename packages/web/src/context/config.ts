import type { ConfigEntry } from "@opencode-ai/client"

export type ConfigInfo = Extract<ConfigEntry, { type: "document" }>["info"]

export function configInfo(entries: ConfigEntry[]): ConfigInfo {
  return Object.assign({}, ...entries.filter((entry) => entry.type === "document").map((entry) => entry.info))
}
