/**
 * Appearance preference row registered into the General section item slot
 * (figma 501:30012 'Frame 2117131228'): title + three preference cubes.
 * Registered by this package — the theme feature owns its own settings
 * surface. Selection follows the persisted preference, never the resolved
 * active theme.
 */
import { useState } from 'react'
import clsx from 'clsx'
import {
  IconChevronDownOutline14, IconDarkOutline16, IconFollowsystemOutline16, IconLightOutline16, Menu,
} from '@isomoes/dsh-web-ui/client/ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@isomoes/dsh-web-ui/client/ui-slots'
import type { ThemePreference } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@isomoes/dsh-web-ui/client/ui-settings/client'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './AppearanceRow.module.css'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface AppearanceRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & PropsLocale<'settings.theme'> & AppearanceRowInjected

/** Cube order and icons (figma 501:30015-30017: Light, Dark, System). */
const CUBES: readonly { id: ThemePreference; labelKey: ThemeKey; Icon: typeof IconLightOutline16 }[] = [
  { id: 'light', labelKey: 'appearance.light', Icon: IconLightOutline16 },
  { id: 'dark', labelKey: 'appearance.dark', Icon: IconDarkOutline16 },
  { id: 'system', labelKey: 'appearance.system', Icon: IconFollowsystemOutline16 },
]

/**
 * Render the Appearance row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AppearanceRow({ t, setTheme, useStore }: AppearanceRowComponentProps) {
  const preference = useStore(s => s.preference)
  const themes = useStore(s => s.themes)
  const [open, setOpen] = useState(false)
  const customThemes = themes.filter(theme => theme.id !== 'light' && theme.id !== 'dark')
  const activeCustom = customThemes.find(theme => theme.id === preference)
  return (
    <div className={css.group}>
      <div className={css.title}>{t('appearance.title')}</div>
      <div className={css.cubeRow}>
        {CUBES.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={clsx(css.themeCube, preference === id && css.selected)}
            aria-pressed={preference === id}
            onClick={() => { setTheme(id) }}
          >
            <Icon />
            {t(labelKey)}
          </button>
        ))}
      </div>
      {customThemes.length > 0 && (
        <div className={css.customRow}>
          <span className={css.customLabel}>{t('appearance.themes')}</span>
          <Menu
            open={open}
            onClose={() => { setOpen(false) }}
            items={customThemes.map(theme => ({ id: theme.id, label: theme.label }))}
            selectedId={activeCustom?.id}
            onSelect={(id) => {
              setTheme(id)
              setOpen(false)
            }}
            align="end"
            portal
            anchor={(
              <button
                type="button"
                className={css.selector}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => { setOpen(value => !value) }}
              >
                {activeCustom?.label ?? t('appearance.chooseTheme')}
                <IconChevronDownOutline14 />
              </button>
            )}
          />
        </div>
      )}
    </div>
  )
}
