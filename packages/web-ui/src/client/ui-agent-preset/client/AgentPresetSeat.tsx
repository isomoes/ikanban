/**
 * The agent-preset chip and Ctrl+P-style picker on the new-session screen.
 * The choice is staged before conversation history fixes the session preset.
 */

import { useEffect, useMemo, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@isomoes/dsh-web-ui/client/ui-slots'
import {
  IconAgentPresetOutline16, IconChevronDownOutline14, SearchPalette,
} from '@isomoes/dsh-web-ui/client/ui-primitives'
// Type-only: pulls the ui-conversation SlotMap merge (the hero seat).
import type {} from '@isomoes/dsh-web-ui/client/ui-conversation/client'
import type { AgentPresetSeatState } from './seat-store.ts'
import { presetDisplayText } from './locales.ts'
import css from './AgentPresetSeat.module.css'

/** Registration-side business face for the hero chip. */
export interface AgentPresetSeatInjected {
  hooks: {
    /** Seat snapshot bound by the renderer as useAgentPresetSeat. */
    agentPresetSeat: SnapshotStore<AgentPresetSeatState>
  }
  /** Read the roster when the chip first renders. */
  load: () => Promise<void>
  /** Stage one preset for the next session. */
  select: (id: string) => Promise<void>
  /** Open or close the picker from the trigger or its UI command. */
  setOpen: (open: boolean) => void
  /** Clear the one-shot introduce cue once the chip has played it. */
  introduced: () => void
}

/* Introduce timeline: the icon eases in first, then the name's characters
   fade up over one capped reveal window. */
const INTRO_TEXT_DELAY_MS = 150
const INTRO_CHAR_STAGGER_MS = 40
const INTRO_TEXT_REVEAL_MS = 200
const INTRO_CHAR_FADE_MS = 400

/** Per-character start offset for the introduce reveal. */
function introStaggerMs(count: number): number {
  if (count <= 1) return 0
  return Math.min(INTRO_CHAR_STAGGER_MS, INTRO_TEXT_REVEAL_MS / (count - 1))
}

/** Full component props. */
export type AgentPresetSeatProps =
  PropsRuntime<'conversation.hero.agentPreset'>
  & PropsLocale<'settings.agentPreset'>
  & InjectFace<AgentPresetSeatInjected>

/** Render the new-session agent-preset chip and palette. */
export function AgentPresetSeat({ load, select, setOpen, introduced, useAgentPresetSeat, t }: AgentPresetSeatProps) {
  const state = useAgentPresetSeat(snapshot => snapshot)
  const open = state.pickerOpen
  const [query, setQuery] = useState('')

  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const chosen = state.options.find(option => option.id === state.current)
  const chosenText = chosen === undefined ? undefined : presetDisplayText(chosen, t)
  const label = chosenText?.name ?? state.current
  const ready = state.options.length > 0 && state.current !== ''
  const paletteItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return state.options
      .map(option => ({ option, text: presetDisplayText(option, t) }))
      .filter(({ option, text }) => needle === '' || [option.id, text.name, text.description ?? '']
        .some(value => value.toLocaleLowerCase().includes(needle)))
      .map(({ option, text }) => ({
        id: option.id,
        title: text.name,
        description: text.description ?? t('noDescription'),
        meta: t(option.trust === 'user' ? 'customGroup' : 'builtInGroup'),
      }))
  }, [query, state.options, t])

  const [introducing, setIntroducing] = useState(false)
  useEffect(() => {
    if (!state.introduce || !ready) return
    const characters = Array.from(label)
    if (characters.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      introduced()
      return
    }
    setIntroducing(true)
    const done = window.setTimeout(() => {
      setIntroducing(false)
      introduced()
    }, INTRO_TEXT_DELAY_MS + (characters.length - 1) * introStaggerMs(characters.length) + INTRO_CHAR_FADE_MS)
    return () => { window.clearTimeout(done) }
  }, [state.introduce, ready, label, introduced])

  if (!ready) return null

  const characters = Array.from(label)
  const stagger = introStaggerMs(characters.length)
  const shownLabel = introducing
    ? (
      <span className={css.introText}>
        {characters.map((character, index) => (
          <span
            key={index}
            className={css.introChar}
            style={{ animationDelay: `${INTRO_TEXT_DELAY_MS + index * stagger}ms` }}
          >
            {character}
          </span>
        ))}
      </span>
    )
    : label

  return (
    <>
      <button
        type="button"
        className={css.seat}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={state.error ?? t('seatHint')}
        disabled={state.busy}
        onClick={() => { setOpen(!open) }}
      >
        <IconAgentPresetOutline16 className={introducing ? `${css.seatIcon} ${css.introIcon}` : css.seatIcon} />
        {shownLabel}
        <IconChevronDownOutline14 className={css.chevron} />
      </button>
      <SearchPalette
        open={open}
        portal
        title={t('chooseModeCommand')}
        closeLabel={t('closePicker')}
        placeholder={t('searchPlaceholder')}
        searchLabel={t('searchAria')}
        listLabel={t('pickerListAria')}
        emptyLabel={t('noMatches')}
        query={query}
        items={paletteItems}
        selectedId={state.current}
        onQueryChange={setQuery}
        onClose={() => { setOpen(false) }}
        onSelect={(id) => {
          setOpen(false)
          void select(id)
        }}
      />
    </>
  )
}
