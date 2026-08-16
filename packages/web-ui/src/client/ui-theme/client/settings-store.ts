/**
 * Appearance row slot store: a mirror of the theme service snapshot. The
 * plugin's apply-world change listener is the only writer; the row component
 * reads via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { ThemePreference } from '../theme-settings.ts'

/** One registered theme exposed to the Appearance picker. */
export interface AppearanceThemeOption {
  id: string
  label: string
}

/** Store state mirrored from the theme snapshot. */
export interface AppearanceRowState {
  /** Persisted preference (selection state reads this, never the resolved active theme). */
  preference: ThemePreference
  /** Registered concrete themes in stable registration order. */
  themes: readonly AppearanceThemeOption[]
  /** Service revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
}

/** Declared action shape giving the exported factory a stable return type. */
type AppearanceRowActions = {
  sync: (
    draft: AppearanceRowState,
    preference: ThemePreference,
    themes: readonly AppearanceThemeOption[],
    revision: number,
  ) => void
}

/**
 * Declares the Appearance row state and write surface.
 * @returns the store handle.
 */
export function createAppearanceRowStore(): EngineStoreHandle<AppearanceRowState, AppearanceRowActions> {
  return defineStore({
    init: (): AppearanceRowState => ({ preference: 'system', themes: [], revision: -1 }),
    actions: {
      sync: (
        d,
        preference: ThemePreference,
        themes: readonly AppearanceThemeOption[],
        revision: number,
      ) => {
        if (revision <= d.revision) return
        d.preference = preference
        d.themes = themes
        d.revision = revision
      },
    },
  })
}
