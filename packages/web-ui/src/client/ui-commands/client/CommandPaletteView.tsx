import { useEffect, useState, useSyncExternalStore } from 'react'
import { SearchPalette } from '@isomoes/dsh-web-ui/client/ui-primitives'
import type { PropsLocale } from '@isomoes/dsh-web-ui/client/ui-slots'
import { filterUiActions, formatKeybind, type UiActionRegistry } from './actions.ts'

export type CommandPaletteViewProps = {
  actions: UiActionRegistry
} & PropsLocale<'command'>

/** Render local UI actions through the shared searchable palette interaction. */
export function CommandPaletteView({ actions, t }: CommandPaletteViewProps) {
  const open = useSyncExternalStore(actions.subscribePalette, actions.getPaletteSnapshot)
  const registered = useSyncExternalStore(actions.subscribe, actions.getSnapshot)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const rows = filterUiActions(registered, query)
  return (
    <SearchPalette
      open={open}
      title={t('palette.title')}
      closeLabel={t('palette.close')}
      placeholder={t('palette.placeholder')}
      searchLabel={t('palette.search.aria')}
      listLabel={t('palette.list.aria')}
      emptyLabel={t('palette.empty')}
      query={query}
      items={rows.map(action => ({
        id: action.id,
        title: action.title(),
        ...action.description === undefined ? {} : { description: action.description() },
        ...action.category === undefined ? {} : { meta: action.category() },
        ...action.keybind === undefined ? {} : { shortcut: formatKeybind(action.keybind, actions.mac) },
      }))}
      onQueryChange={setQuery}
      onClose={() => { actions.closePalette() }}
      onSelect={(id) => {
        actions.closePalette()
        actions.trigger(id, 'palette')
      }}
    />
  )
}
