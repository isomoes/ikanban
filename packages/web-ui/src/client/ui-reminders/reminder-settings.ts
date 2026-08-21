/** Durable browser reminder-sound preferences. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the reminder feature. */
export const REMINDER_SETTINGS_NAMESPACE = 'ui-reminders'

/** Completion sound preference field. */
export const COMPLETION_SOUND_FIELD = 'completionSound'
/** Blocking-attention sound preference field. */
export const ATTENTION_SOUND_FIELD = 'attentionSound'

/** Reminder preferences shared by the Host schema and browser scope. */
export interface ReminderSettings {
  /** Play a chime when a running session becomes idle. */
  completionSound: boolean
  /** Play an alert when a session begins waiting for user interaction. */
  attentionSound: boolean
}

/** Defaults retain the v0.3 behavior: both agent and permission sounds are on. */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  completionSound: true,
  attentionSound: true,
}

/** Durable settings schema registered by the Host half. */
export const ReminderSettingsSchema: z<ReminderSettings> = z.object({
  [COMPLETION_SOUND_FIELD]: z.boolean().default(DEFAULT_REMINDER_SETTINGS.completionSound),
  [ATTENTION_SOUND_FIELD]: z.boolean().default(DEFAULT_REMINDER_SETTINGS.attentionSound),
})
