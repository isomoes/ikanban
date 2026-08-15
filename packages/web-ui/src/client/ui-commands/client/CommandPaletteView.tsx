import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { filterUiActions, formatKeybind, type UiActionRegistry } from './actions.ts'
import css from './CommandPaletteView.module.css'

export type CommandPaletteViewProps = {
  actions: UiActionRegistry
} & PropsLocale<'command'>

export function CommandPaletteView({ actions, t }: CommandPaletteViewProps) {
  const open = useSyncExternalStore(actions.subscribePalette, actions.getPaletteSnapshot)
  const registered = useSyncExternalStore(actions.subscribe, actions.getSnapshot)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    searchRef.current?.focus()
  }, [open])

  const rows = filterUiActions(registered, query)
  const selected = rows.length === 0 ? -1 : Math.min(active, rows.length - 1)
  useEffect(() => {
    if (selected < 0) return
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  const choose = (index: number): void => {
    const action = rows[index]
    if (action === undefined) return
    actions.closePalette()
    actions.trigger(action.id, 'palette')
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      actions.closePalette()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(value => rows.length === 0 ? 0 : (value + 1) % rows.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(value => rows.length === 0 ? 0 : (value - 1 + rows.length) % rows.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(selected)
    }
  }

  return (
    <div className={css.layer} role="presentation" onKeyDown={onKeyDown}>
      <button type="button" className={css.backdrop} aria-label={t('palette.close')} onClick={() => { actions.closePalette() }} />
      <section className={css.palette} role="dialog" aria-modal="true" aria-label={t('palette.title')}>
        <div className={css.searchRow}>
          <span className={css.prompt} aria-hidden="true">&gt;</span>
          <input
            ref={searchRef}
            className={css.search}
            value={query}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.search.aria')}
            onChange={(event) => { setQuery(event.currentTarget.value); setActive(0) }}
          />
          <kbd className={css.escape}>Esc</kbd>
        </div>
        <div ref={listRef} className={css.list} role="listbox" aria-label={t('palette.list.aria')}>
          {rows.length === 0 && <div className={css.empty}>{t('palette.empty')}</div>}
          {rows.map((action, index) => (
            <button
              key={action.id}
              type="button"
              role="option"
              aria-selected={index === selected}
              className={css.action}
              onPointerMove={() => { setActive(index) }}
              onClick={() => { choose(index) }}
            >
              <span className={css.copy}>
                <span className={css.title}>{action.title()}</span>
                {action.description !== undefined && <span className={css.description}>{action.description()}</span>}
              </span>
              {action.category !== undefined && <span className={css.category}>{action.category()}</span>}
              {action.keybind !== undefined && <kbd className={css.keybind}>{formatKeybind(action.keybind, actions.mac)}</kbd>}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
