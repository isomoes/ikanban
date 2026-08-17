/** User-facing keyboard shortcut editor inside the Settings panel. */
import { useMemo, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import {
  Button, IconSearchOutline16, Input,
} from '@isomoes/dsh-ikanban/client/ui-primitives'
import type { PropsLocale, PropsRuntime } from '@isomoes/dsh-ikanban/client/ui-slots'
import type {} from '@isomoes/dsh-ikanban/client/ui-settings/client'
import type { CommandUiRuntime } from './service.ts'
import {
  COMMAND_PALETTE_ACTION_ID, formatKeybind, keybindFromEvent, parseKeybind,
} from './actions.ts'
import css from './KeymapSettingsSection.module.css'

/** Settings-page dependencies supplied by the command feature. */
export interface KeymapSettingsInjected {
  readonly commandUi: CommandUiRuntime
}

export type KeymapSettingsComponentProps =
  PropsRuntime<'settings.section'> & PropsLocale<'settings.shortcuts'> & KeymapSettingsInjected

interface KeymapRow {
  readonly id: string
  readonly title: string
  readonly category: string
}

function bindingIdentity(config: string | undefined, mac: boolean): string | undefined {
  if (config === undefined || config === '' || config === 'none') return undefined
  const parsed = parseKeybind(config, mac)[0]
  return parsed === undefined ? undefined : JSON.stringify(parsed)
}

/** Render all registered action shortcuts with capture, disable, search, and reset controls. */
export function KeymapSettingsSection({ commandUi, t }: KeymapSettingsComponentProps) {
  const actions = useSyncExternalStore(
    commandUi.actions.subscribe,
    commandUi.actions.getSnapshot,
    commandUi.actions.getSnapshot,
  )
  useSyncExternalStore(
    listener => commandUi.shortcutSettings.subscribe(listener),
    () => commandUi.shortcutSettings.getSnapshot(),
    () => commandUi.shortcutSettings.getSnapshot(),
  )
  const [recording, setRecording] = useState<string>()
  const [query, setQuery] = useState('')
  const rows = useMemo<readonly KeymapRow[]>(() => [
    { id: COMMAND_PALETTE_ACTION_ID, title: t('palette'), category: t('interface') },
    ...actions.map(action => ({
      id: action.id,
      title: action.title(),
      category: action.category?.() ?? t('interface'),
    })),
  ], [actions, t])
  const visibleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (needle === '') return rows
    return rows.filter(row => `${row.title} ${row.category}`.toLocaleLowerCase().includes(needle))
  }, [query, rows])
  const conflicts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const identity = bindingIdentity(commandUi.actions.getKeybind(row.id), commandUi.actions.mac)
      if (identity !== undefined) counts.set(identity, (counts.get(identity) ?? 0) + 1)
    }
    return counts
  }, [actions, rows, commandUi.actions])
  const customizedCount = rows.filter(row => commandUi.actions.hasKeybindOverride(row.id)).length
  const persistence = commandUi.shortcutPersistence()
  const persistenceLabel = persistence === 'profile'
    ? t('storageProfile')
    : persistence === 'browser' ? t('storageBrowser') : t('storageMemory')

  const capture = (id: string, event: KeyboardEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') {
      setRecording(undefined)
      return
    }
    const keybind = keybindFromEvent(event)
    if (keybind === undefined) return
    commandUi.setKeybindOverride(id, keybind)
    setRecording(undefined)
  }

  return (
    <section className={css.section} aria-labelledby="keymap-settings-title">
      <header className={css.header}>
        <div className={css.heading}>
          <h2 id="keymap-settings-title" className={css.title}>{t('title')}</h2>
          <p className={css.description}>{t('description')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={customizedCount === 0}
          onClick={() => { commandUi.resetKeybindOverrides() }}
        >
          {t('resetAll')}
        </Button>
      </header>

      <div className={css.toolbar}>
        <Input
          className={css.search ?? ''}
          icon={<IconSearchOutline16 />}
          type="search"
          value={query}
          placeholder={t('search')}
          aria-label={t('searchAria')}
          onChange={event => { setQuery(event.currentTarget.value) }}
        />
        <span className={css.persistence}><span className={css.statusDot} />{persistenceLabel}</span>
      </div>

      <div className={css.list}>
        {visibleRows.length === 0 && <div className={css.empty}>{t('empty')}</div>}
        {visibleRows.map((row) => {
          const keybind = commandUi.actions.getKeybind(row.id)
          const defaultKeybind = commandUi.actions.getDefaultKeybind(row.id)
          const customized = commandUi.actions.hasKeybindOverride(row.id)
          const identity = bindingIdentity(keybind, commandUi.actions.mac)
          const conflict = identity !== undefined && (conflicts.get(identity) ?? 0) > 1
          const isRecording = recording === row.id
          const display = keybind === 'none'
            ? t('disabled')
            : formatKeybind(keybind ?? '', commandUi.actions.mac)
          return (
            <div className={css.row} key={row.id}>
              <div className={css.actionCopy}>
                <div className={css.actionHeading}>
                  <span className={css.actionTitle}>{row.title}</span>
                  {customized && <span className={css.customBadge}>{t('customized')}</span>}
                </div>
                <span className={css.actionMeta}>
                  {row.category}
                  {defaultKeybind !== undefined && (
                    <> · {t('default')} {formatKeybind(defaultKeybind, commandUi.actions.mac)}</>
                  )}
                </span>
                {conflict && <span className={css.conflict}>{t('conflict')}</span>}
              </div>

              <div className={css.bindingColumn}>
                <button
                  type="button"
                  className={`${css.keyButton} ${isRecording ? css.recording : ''}`}
                  aria-label={t('recordAria', { action: row.title })}
                  aria-pressed={isRecording}
                  onClick={() => { setRecording(isRecording ? undefined : row.id) }}
                  onKeyDown={(event) => { if (isRecording) capture(row.id, event) }}
                >
                  {isRecording ? t('recording') : <kbd>{display}</kbd>}
                </button>
                {isRecording && <span className={css.recordHint}>{t('recordHint')}</span>}
              </div>

              <div className={css.controls}>
                {keybind !== 'none' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { commandUi.setKeybindOverride(row.id, 'none') }}
                  >
                    {t('disable')}
                  </Button>
                )}
                {customized && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { commandUi.setKeybindOverride(row.id, undefined) }}
                  >
                    {t('reset')}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
