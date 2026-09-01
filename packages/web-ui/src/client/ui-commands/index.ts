/** Host registration for the command UI's profile-backed shortcut settings. */

import type { Context } from '@deepseek-ai/cordis'
import { COMMAND_SETTINGS_NAMESPACE, CommandSettingsSchema } from './shortcut-settings.ts'

export {
  COMMAND_SETTINGS_NAMESPACE, CommandSettingsSchema, KEYBIND_OVERRIDES_FIELD,
  type CommandSettings,
} from './shortcut-settings.ts'

/** Register the durable shortcut section when a settings provider exists. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(COMMAND_SETTINGS_NAMESPACE, CommandSettingsSchema)
  })
}
