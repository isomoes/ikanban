import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { AgentPresets, PresetRoot } from '@deepseek-ai/dsh-agent-presets'

export const name = 'ikanban-preset'
export const inject = ['agentPresets']

export const IKANBAN_PRESET_ID = 'ikanban'
export const IKANBAN_PRESET_NAME = 'iKanban'

/** The package-owned preset root resolved from the compiled `lib` entry. */
export const IKANBAN_PRESET_ROOT = fileURLToPath(new URL('../preset/', import.meta.url))

type PresetRegistry = Pick<AgentPresets, 'roots'>

/**
 * Add the package's read-only preset directory ahead of user-authored roots.
 * A system root wins duplicate ids, keeping the built-in preset immutable.
 */
export function registerIkanbanPresetRoot(agentPresets: PresetRegistry): 'existing' | 'registered' {
  if (agentPresets.roots.some(root => root.path === IKANBAN_PRESET_ROOT)) return 'existing'

  // AgentPresets exposes the effective roots as readonly to consumers, but root
  // providers intentionally extend the underlying startup-time list in place.
  const roots = agentPresets.roots as PresetRoot[]
  roots.unshift({ path: IKANBAN_PRESET_ROOT, trust: 'system' })
  return 'registered'
}

export function apply(ctx: Context): void {
  registerIkanbanPresetRoot(ctx.agentPresets)
}
