/** Live reminder preference mirror over the Host settings scope. */

import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  ATTENTION_SOUND_FIELD, COMPLETION_SOUND_FIELD, DEFAULT_REMINDER_SETTINGS,
  type ReminderSettings,
} from '../reminder-settings.ts'

/** Browser-owned live preference state and durable write boundary. */
export class ReminderPreferences {
  readonly completionSound: SnapshotStore<boolean> = createSnapshotStore(DEFAULT_REMINDER_SETTINGS.completionSound)
  readonly attentionSound: SnapshotStore<boolean> = createSnapshotStore(DEFAULT_REMINDER_SETTINGS.attentionSound)
  private readonly unsubscribe: () => void

  constructor(private readonly host: SettingsScope<ReminderSettings>) {
    this.unsubscribe = host.subscribe(() => { this.adopt() })
    this.adopt()
  }

  /** Release the settings mirror subscription with the owning plugin fiber. */
  dispose(): void {
    this.unsubscribe()
  }

  /** Whether the Host has resolved this namespace (including memory mode). */
  isReady(): boolean {
    return this.host.getSnapshot().status !== 'loading'
  }

  setCompletionSound(enabled: boolean): void {
    if (this.completionSound.getSnapshot() === enabled) return
    this.completionSound.set(enabled)
    void this.host.set(COMPLETION_SOUND_FIELD, enabled)
  }

  setAttentionSound(enabled: boolean): void {
    if (this.attentionSound.getSnapshot() === enabled) return
    this.attentionSound.set(enabled)
    void this.host.set(ATTENTION_SOUND_FIELD, enabled)
  }

  private adopt(): void {
    const value = this.host.getSnapshot().value
    if (value === undefined) return
    if (this.completionSound.getSnapshot() !== value.completionSound) {
      this.completionSound.set(value.completionSound)
    }
    if (this.attentionSound.getSnapshot() !== value.attentionSound) {
      this.attentionSound.set(value.attentionSound)
    }
  }
}
