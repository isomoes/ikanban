/** Theme preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Built-in preferences accepted at the registry and settings boundaries. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** Settings namespace owned by the theme plugin. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Field carrying the selected built-in or registered theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Theme preference persisted by the product Appearance row (built-in or registered id). */
export type ThemePreference = string

/** Default preference when the user-settings document has no override. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Durable theme section shared by the Host schema and the browser scope. */
export interface ThemeSettings {
  /** Selected built-in or registered theme id. */
  preference: ThemePreference
}

/** Durable theme schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  [THEME_PREFERENCE_FIELD]: z.string().default(DEFAULT_PREFERENCE),
})

/**
 * Narrow one wire or registry value to a persistable theme id.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a non-empty theme id.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && value.length > 0
}
