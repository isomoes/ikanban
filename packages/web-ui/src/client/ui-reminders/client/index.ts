/**
 * Session reminder-sound plugin, browser half. It observes the authoritative
 * session-list projection, owns playback for the plugin fiber, and contributes
 * its durable controls to General settings.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@isomoes/dsh-web-ui/client/ui-session/client'
import type {} from '@isomoes/dsh-web-ui/client/ui-settings/client'
import type {} from '@isomoes/dsh-web-ui/client/locale/client'
import type {} from '@isomoes/dsh-web-ui/client/ui-slots'
import { REMINDER_SETTINGS_NAMESPACE, type ReminderSettings } from '../reminder-settings.ts'
import { en, zh, type ReminderKey } from './locales.ts'
import { SessionReminderObserver } from './observer.ts'
import { ReminderPreferences } from './preferences.ts'
import { ReminderSoundPlayer } from './sound-player.ts'
import { ReminderSoundsRow, type ReminderSoundsRowInjected } from './ReminderSoundsRow.tsx'

/** Locale namespace owned by this feature's Settings row. */
const NS = 'settings.reminders'

declare module '@isomoes/dsh-web-ui/client/ui-slots' {
  interface LocaleNamespaceMap {
    /** Reminder sound controls in General settings. */
    'settings.reminders': ReminderKey
  }
}

/** Runtime/session facts plus feature-owned settings and Settings-row dependencies. */
export const inject = ['sessions', 'uiSession', 'settingsScope', 'slots', 'locale']

/** Mount list-edge detection, lifecycle-owned playback, and settings controls. */
export function apply(ctx: ClientContext): void {
  const preferences = new ReminderPreferences(
    ctx.settingsScope.bind<ReminderSettings>({ namespace: REMINDER_SETTINGS_NAMESPACE }),
  )
  const player = new ReminderSoundPlayer()
  const observer = new SessionReminderObserver()
  const sync = (): void => {
    const pending = ctx.uiSession.pendingInteractions.getSnapshot()
    const rows = Object.values(ctx.sessions.list.getSnapshot().byId).map(row => {
      const interaction = pending.get(row.id)
      return {
        id: row.id,
        running: row.running,
        ...(row.origin === undefined ? {} : { origin: row.origin }),
        ...(interaction === undefined ? {} : { pendingInteraction: interaction.kind }),
      }
    })
    for (const event of observer.update(rows)) {
      // Consume edges while settings load, but never guess over a persisted
      // disabled preference. Later snapshots only report genuinely new edges.
      if (!preferences.isReady()) continue
      if (event.kind === 'completion' && preferences.completionSound.getSnapshot()) {
        player.play('completion')
      } else if (event.kind === 'attention' && preferences.attentionSound.getSnapshot()) {
        player.play('attention')
      }
    }
  }

  // Seed before subscribing: existing idle/waiting sessions never chime on boot.
  sync()
  ctx.effect(() => ctx.sessions.list.subscribe(sync), 'ui-reminders: session-list observer')
  ctx.effect(() => ctx.uiSession.pendingInteractions.subscribe(sync), 'ui-reminders: interaction observer')
  ctx.effect(() => player.installUnlock(), 'ui-reminders: audio unlock')
  ctx.effect(() => () => {
    preferences.dispose()
    player.dispose()
  }, 'ui-reminders: sound and settings lifetime')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-reminders: dictionaries')

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'reminder-sounds',
    order: 30,
    locale: NS,
    inject: (): ReminderSoundsRowInjected => ({
      hooks: {
        completionSound: preferences.completionSound,
        attentionSound: preferences.attentionSound,
      },
      setCompletionSound: enabled => { preferences.setCompletionSound(enabled) },
      setAttentionSound: enabled => { preferences.setAttentionSound(enabled) },
    }),
  }, ReminderSoundsRow))
}

export { SessionReminderObserver } from './observer.ts'
export type { ReminderEvent, ReminderSessionRow } from './observer.ts'
