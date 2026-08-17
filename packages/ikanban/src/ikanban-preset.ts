import { appendFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { AgentPreset, AgentPresets } from '@deepseek-ai/dsh-agent-presets'

export const name = 'ikanban-preset'
export const inject = ['agentPresets']

export const IKANBAN_PRESET_ID = 'ikanban'
export const IKANBAN_PRESET_NAME = 'iKanban'

const PROJECT_MCP_ROW = `
# iKanban project-level MCP support. This preset is opt-in because .mcp.json
# may declare stdio commands supplied by the selected project.
- id: project-mcp
  name: '@isomoes/dsh-ikanban/project-mcp'
`

type PresetAuthoring = Pick<AgentPresets, 'copy' | 'list' | 'remove'>

function findInstalled(presets: readonly AgentPreset[]): AgentPreset | undefined {
  return presets.find(preset => preset.id === IKANBAN_PRESET_ID)
}

export async function ensureIkanbanPreset(agentPresets: PresetAuthoring): Promise<'existing' | 'installed'> {
  if (findInstalled(await agentPresets.list()) !== undefined) return 'existing'

  let copied = false
  try {
    try {
      await agentPresets.copy('standard', IKANBAN_PRESET_ID, IKANBAN_PRESET_NAME)
      copied = true
    } catch (error) {
      // Another process may have won the same first-start race. Preserve that
      // preset exactly as authored rather than appending to an unknown file.
      if (findInstalled(await agentPresets.list()) !== undefined) return 'existing'
      throw error
    }

    const preset = findInstalled(await agentPresets.list())
    if (preset === undefined) {
      throw new Error(`ikanban-preset: copied preset "${IKANBAN_PRESET_ID}" was not discoverable`)
    }
    await appendFile(preset.path, PROJECT_MCP_ROW, 'utf8')
    return 'installed'
  } catch (error) {
    if (copied) {
      try {
        await agentPresets.remove(IKANBAN_PRESET_ID)
      } catch {
        // Preserve the original installation failure. A later startup will see
        // the leftover preset and never overwrite it.
      }
    }
    throw error
  }
}

export async function apply(ctx: Context): Promise<void> {
  await ensureIkanbanPreset(ctx.agentPresets)
}
