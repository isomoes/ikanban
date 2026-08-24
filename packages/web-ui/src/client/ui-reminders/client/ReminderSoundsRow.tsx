/** General Settings row for session reminder sounds. */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@isomoes/dsh-web-ui/client/ui-slots'
import type { ReminderKey } from './locales.ts'
import css from './ReminderSoundsRow.module.css'

/** Registration-side settings face. */
export interface ReminderSoundsRowInjected {
  hooks: {
    completionSound: SnapshotStore<boolean>
    attentionSound: SnapshotStore<boolean>
  }
  setCompletionSound: (enabled: boolean) => void
  setAttentionSound: (enabled: boolean) => void
}

export type ReminderSoundsRowProps = PropsRuntime<'settings.general.item'>
  & PropsLocale<'settings.reminders'>
  & InjectFace<ReminderSoundsRowInjected>

function SoundToggle({
  title, description, enabled, setEnabled,
}: {
  title: string
  description: string
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}) {
  return (
    <div className={css.option}>
      <div className={css.optionText}>
        <div className={css.optionTitle}>{title}</div>
        <div className={css.optionDescription}>{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        className={css.switch}
        data-checked={enabled || undefined}
        onClick={() => { setEnabled(!enabled) }}
      >
        <span className={css.thumb} />
      </button>
    </div>
  )
}

/** Render both independently persisted reminder controls. */
export function ReminderSoundsRow({
  useCompletionSound, useAttentionSound, setCompletionSound, setAttentionSound, t,
}: ReminderSoundsRowProps) {
  const completion = useCompletionSound(value => value)
  const attention = useAttentionSound(value => value)
  const copy = (key: ReminderKey): string => t(key)
  return (
    <section className={css.group} aria-label={copy('title')}>
      <div className={css.heading}>
        <div className={css.title}>{copy('title')}</div>
        <div className={css.description}>{copy('description')}</div>
      </div>
      <SoundToggle
        title={copy('completion')}
        description={copy('completion.description')}
        enabled={completion}
        setEnabled={setCompletionSound}
      />
      <SoundToggle
        title={copy('attention')}
        description={copy('attention.description')}
        enabled={attention}
        setEnabled={setAttentionSound}
      />
    </section>
  )
}
