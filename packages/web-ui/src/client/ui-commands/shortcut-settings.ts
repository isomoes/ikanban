/** Durable profile settings for local UI-action keyboard shortcuts. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the command UI plugin. */
export const COMMAND_SETTINGS_NAMESPACE = 'ui-commands'

/** Field carrying action-id to keybind overrides. */
export const KEYBIND_OVERRIDES_FIELD = 'keybinds'

/** Profile-backed shortcut overrides; `none` explicitly disables a shortcut. */
export interface CommandSettings {
  keybinds: Record<string, string>
}

/** Dynamic action ids require a string dictionary rather than fixed schema keys. */
export const CommandSettingsSchema: z<CommandSettings> = z.object({
  [KEYBIND_OVERRIDES_FIELD]: z.dict(z.string()).default({}),
})
