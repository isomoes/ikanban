/** Host registration for browser reminder-sound preferences. */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { REMINDER_SETTINGS_NAMESPACE, ReminderSettingsSchema } from './reminder-settings.ts'

export {
  ATTENTION_SOUND_FIELD, COMPLETION_SOUND_FIELD, DEFAULT_REMINDER_SETTINGS,
  REMINDER_SETTINGS_NAMESPACE, type ReminderSettings,
} from './reminder-settings.ts'
export { SessionReminderObserver } from './client/observer.ts'
export type { ReminderEvent, ReminderSessionRow } from './client/observer.ts'

/** Register the durable reminder section when the settings service is present. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(REMINDER_SETTINGS_NAMESPACE),
      ReminderSettingsSchema,
    )
  })
}
