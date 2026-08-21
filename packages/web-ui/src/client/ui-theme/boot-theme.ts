/**
 * Theme bootstrap row for the browser's pre-plugin interval. Each index
 * render embeds the current durable preference; before the client registry
 * loads, custom theme ids use the system scheme and write the same DOM fields
 * ui-layout's ThemePresenter owns after the client plugin tree activates.
 */

import type { IndexInjection } from '@deepseek-ai/dsh-host-webserver'
import { DEFAULT_PREFERENCE, type ThemePreference } from './theme-settings.ts'

/** Build the inline script body for one schema-validated theme preference. */
function bootThemeScript(preference: ThemePreference): string {
  return `(() => {
  const preference = ${JSON.stringify(preference)}
  const systemDark = preference !== 'light' && preference !== 'dark'
    && typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-color-scheme: dark)').matches
  const dark = preference === 'dark' || systemDark
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.body.toggleAttribute('data-ds-dark-theme', dark)
})()`
}

/**
 * The theme bootstrap as an injection row: an inline script immediately after
 * the opening body tag, before the shell mount and module script.
 * @param preference - Current Host-backed theme preference.
 * @returns the body script row.
 */
export function bootThemeInjection(
  preference: ThemePreference = DEFAULT_PREFERENCE,
): IndexInjection {
  return { kind: 'script', placement: 'body', text: bootThemeScript(preference) }
}
