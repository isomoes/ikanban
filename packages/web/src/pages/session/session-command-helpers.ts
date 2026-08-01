import { supportsRuntimeCapability, type RuntimeCapability } from "@/context/global-sync/runtime-capabilities"

export const canAddSelectionContext = (input: {
  active?: string
  pathFromTab: (tab: string) => string | undefined
  selectedLines: (path: string) => unknown
}) => {
  if (!input.active) return false
  const path = input.pathFromTab(input.active)
  if (!path) return false
  return input.selectedLines(path) != null
}

export const restartOpenCode = async (input: {
  directory: string
  dispose: (input: { directory: string }) => Promise<unknown>
  loadConfig: () => Promise<unknown>
  loadSkills: () => Promise<unknown>
  loadMcp: () => Promise<unknown>
}) => {
  await input.dispose({ directory: input.directory })
  await Promise.all([input.loadConfig(), input.loadSkills(), input.loadMcp()])
}

const commandCapabilities: Record<string, RuntimeCapability> = {
  "project.restartOpenCode": "restart",
  "session.undo": "revert",
  "session.timeline": "revert",
  "session.redo": "revert",
  "session.compact": "summarize",
}

export function filterRuntimeCommands<T extends { id: string }>(commands: T[], config: unknown) {
  return commands.filter((command) => {
    const capability = commandCapabilities[command.id]
    return !capability || supportsRuntimeCapability(config, capability)
  })
}
