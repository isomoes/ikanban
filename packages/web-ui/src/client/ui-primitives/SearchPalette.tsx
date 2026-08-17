import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconCheckOutline16 } from './icons/index.tsx'
import css from './SearchPalette.module.css'

/** One already-filtered row in a searchable command-palette surface. */
export interface SearchPaletteItem {
  readonly id: string
  readonly title: ReactNode
  readonly description?: ReactNode
  readonly meta?: ReactNode
  readonly shortcut?: string
}

/** Shared interaction contract used by Ctrl+P and focused feature pickers. */
export interface SearchPaletteProps {
  readonly open: boolean
  readonly title: string
  readonly closeLabel: string
  readonly placeholder: string
  readonly searchLabel: string
  readonly listLabel: string
  readonly emptyLabel: string
  readonly query: string
  readonly items: readonly SearchPaletteItem[]
  readonly selectedId?: string
  readonly portal?: boolean
  readonly onQueryChange: (query: string) => void
  readonly onSelect: (id: string) => void
  readonly onClose: () => void
}

/**
 * Render the Ctrl+P interaction model: focused search, cyclic arrow-key
 * highlight, Enter selection, Escape dismissal, and pointer highlighting.
 */
export function SearchPalette({
  open, title, closeLabel, placeholder, searchLabel, listLabel, emptyLabel,
  query, items, selectedId, portal = false, onQueryChange, onSelect, onClose,
}: SearchPaletteProps) {
  const [active, setActive] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setActive(0)
    searchRef.current?.focus()
  }, [open])

  const highlighted = items.length === 0 ? -1 : Math.min(active, items.length - 1)
  useEffect(() => {
    if (highlighted < 0) return
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  if (!open) return null

  const choose = (index: number): void => {
    const item = items[index]
    if (item !== undefined) onSelect(item.id)
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(value => items.length === 0 ? 0 : (value + 1) % items.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(value => items.length === 0 ? 0 : (value - 1 + items.length) % items.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(highlighted)
    }
  }

  const layer = (
    <div className={css.layer} role="presentation" onKeyDown={onKeyDown}>
      <button type="button" className={css.backdrop} aria-label={closeLabel} onClick={onClose} />
      <section className={css.palette} role="dialog" aria-modal="true" aria-label={title}>
        <div className={css.searchRow}>
          <span className={css.prompt} aria-hidden="true">&gt;</span>
          <input
            ref={searchRef}
            className={css.search}
            value={query}
            placeholder={placeholder}
            aria-label={searchLabel}
            onChange={(event) => { onQueryChange(event.currentTarget.value); setActive(0) }}
          />
          <kbd className={css.escape}>Esc</kbd>
        </div>
        <div ref={listRef} className={css.list} role="listbox" aria-label={listLabel}>
          {items.length === 0 && <div className={css.empty}>{emptyLabel}</div>}
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === highlighted}
              className={css.action}
              onPointerMove={() => { setActive(index) }}
              onClick={() => { choose(index) }}
            >
              <span className={css.copy}>
                <span className={css.title}>{item.title}</span>
                {item.description !== undefined && <span className={css.description}>{item.description}</span>}
              </span>
              {item.meta !== undefined && <span className={css.meta}>{item.meta}</span>}
              {item.id === selectedId && <IconCheckOutline16 className={css.check} />}
              {item.shortcut !== undefined && <kbd className={css.keybind}>{item.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
  return portal ? createPortal(layer, document.body) : layer
}
