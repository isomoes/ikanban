export type RuntimeCapability = "worktree" | "revert" | "summarize" | "restart"

export function supportsRuntimeCapability(config: unknown, capability: RuntimeCapability) {
  if (!config || typeof config !== "object") return true
  const metadata = (config as { ikanban?: unknown }).ikanban
  if (!metadata || typeof metadata !== "object") return true
  const runtime = metadata as { runtime?: unknown; capabilities?: unknown }
  if (runtime.capabilities && typeof runtime.capabilities === "object") {
    const advertised = (runtime.capabilities as Record<string, unknown>)[capability]
    if (typeof advertised === "boolean") return advertised
  }
  return runtime.runtime !== "pi"
}
