import type { ThemeDefinition, ThemeTokens } from './index.ts'
import githubDarkColorblindJson from '../themes/github-dark-colorblind.json'

/** Seed colors understood by the legacy OpenCode desktop-theme format. */
interface DesktopThemeSeeds {
  neutral: string
  primary: string
  success: string
  warning: string
  error: string
  info: string
  interactive: string
  diffAdd: string
  diffDelete: string
}

/** One light or dark branch in an OpenCode desktop-theme document. */
interface DesktopThemeVariant {
  seeds: DesktopThemeSeeds
  overrides?: Record<string, string>
}

/** JSON theme format used by iKanban through v0.3.18. */
export interface DesktopTheme {
  $schema?: string
  name: string
  id: string
  light: DesktopThemeVariant
  dark: DesktopThemeVariant
}

/**
 * Translate the portable desktop-theme vocabulary onto the current DSH design
 * aliases. The original document remains the color authority; generated
 * translucent states use color-mix so one seed consistently supplies the
 * related current aliases.
 */
function variantTokens(variant: DesktopThemeVariant): ThemeTokens {
  const { seeds, overrides = {} } = variant
  const value = (name: string, fallback: string): string => overrides[name] ?? fallback
  const background = value('background-base', seeds.neutral)
  const weakBackground = value('background-weak', background)
  const strongBackground = value('background-strong', weakBackground)
  const strongerBackground = value('background-stronger', background)
  const surface = value('surface-base', weakBackground)
  const text = value('text-base', seeds.neutral)
  const weakText = value('text-weak', text)
  const strongText = value('text-strong', text)
  const interactive = value('text-interactive-base', seeds.interactive)
  const borderWeak = value('border-weak-base', weakText)
  const border = value('border-base', borderWeak)
  const borderStrong = value('border-strong-base', border)
  const mix = (color: string, amount: number): string =>
    `color-mix(in srgb, ${color} ${amount}%, ${background})`

  return Object.freeze({
    '--dsw-alias-bg-base': background,
    '--dsw-alias-bg-layer-1': weakBackground,
    '--dsw-alias-bg-layer-2': strongBackground,
    '--dsw-alias-bg-layer-3': strongerBackground,
    '--dsw-alias-bg-module-platform': surface,
    '--dsw-alias-bg-multi-select': surface,
    '--dsw-alias-bg-overlay': strongerBackground,
    '--dsw-alias-border-l1': borderWeak,
    '--dsw-alias-border-l2-darkmode-thin': border,
    '--dsw-alias-border-l2': border,
    '--dsw-alias-border-l3': borderStrong,
    '--dsw-alias-border-l4': borderStrong,
    '--dsw-alias-brand-primary-new-colorprimary-new-color': seeds.primary,
    '--dsw-alias-brand-primary': interactive,
    '--dsw-alias-brand-text': interactive,
    '--dsw-alias-button-info-fill': seeds.primary,
    '--dsw-alias-button-info-hover': mix(seeds.primary, 82),
    '--dsw-alias-button-primary-fill': seeds.primary,
    '--dsw-alias-button-primary-hover': mix(seeds.primary, 82),
    '--dsw-alias-interactive-bg-active': mix(seeds.interactive, 22),
    '--dsw-alias-interactive-bg-hover-accent': mix(seeds.interactive, 18),
    '--dsw-alias-interactive-bg-hover-solid': mix(seeds.interactive, 14),
    '--dsw-alias-interactive-bg-hover': mix(seeds.interactive, 10),
    '--dsw-alias-label-caption': weakText,
    '--dsw-alias-label-primary-bluish': interactive,
    '--dsw-alias-label-primary': text,
    '--dsw-alias-label-secondary': weakText,
    '--dsw-alias-label-tertiary': value('icon-base', weakText),
    '--dsw-alias-markdown-citation': borderWeak,
    '--dsw-alias-markdown-code-block-banner': weakBackground,
    '--dsw-alias-markdown-code-block': strongBackground,
    '--dsw-alias-markdown-inline-code': surface,
    '--dsw-alias-markdown-placeholder': weakBackground,
    '--dsw-alias-markdown-tag': surface,
    '--dsw-alias-state-business-primary': seeds.info,
    '--dsw-alias-state-business-tertiary': mix(seeds.info, 16),
    '--dsw-alias-state-error-primary': seeds.error,
    '--dsw-alias-state-error-secondary': mix(seeds.error, 72),
    '--dsw-alias-state-success-primary': seeds.success,
    '--dsw-alias-state-success-secondary': mix(seeds.success, 72),
    '--dsw-alias-state-success-tertiary': mix(seeds.success, 16),
    '--dsw-alias-state-warn-label': seeds.warning,
    '--dsw-alias-state-warn-primary': seeds.warning,
    '--dsw-alias-state-warn-secondary': mix(seeds.warning, 72),
    '--dsw-alias-state-warn-tertiary': mix(seeds.warning, 16),
    '--dsw-alias-toast-bg': strongerBackground,
    '--dsw-alias-tooltip-bg': strongerBackground,
    '--dsw-specific-bubble-highlight': value('surface-diff-add-strong', mix(seeds.diffAdd, 24)),
    '--dsw-specific-bubble': value('surface-diff-add-base', mix(seeds.diffAdd, 14)),
    '--dsw-specific-input-major': surface,
    '--dsw-specific-menu': strongerBackground,
    '--dsw-specific-selector': surface,
    '--dsw-specific-sidebar-fill': weakBackground,
    '--dsw-specific-sidebar-nav-item-active-accent': mix(seeds.interactive, 20),
    '--dsw-specific-sidebar-nav-item-active': mix(seeds.interactive, 14),
    '--dsw-specific-sidebar-nav-item-hover': mix(seeds.interactive, 10),
    '--dsw-specific-tip': surface,
    '--shiki-foreground': value('markdown-code-block', strongText),
    '--shiki-background': strongBackground,
    '--shiki-token-constant': value('syntax-constant', seeds.info),
    '--shiki-token-string': value('syntax-string', seeds.success),
    '--shiki-token-comment': weakText,
    '--shiki-token-keyword': value('syntax-primitive', seeds.error),
    '--shiki-token-parameter': value('syntax-type', seeds.warning),
    '--shiki-token-function': value('syntax-property', seeds.info),
    '--shiki-token-string-expression': value('syntax-string', seeds.success),
    '--shiki-token-punctuation': weakText,
    '--shiki-token-link': value('markdown-link', interactive),
  })
}

/** Convert one v0.3 desktop-theme JSON document into a current registry entry. */
export function desktopThemeDefinition(theme: DesktopTheme): ThemeDefinition {
  return Object.freeze({
    id: theme.id,
    label: theme.name,
    colorScheme: 'dark',
    tokens: Object.freeze({}),
    variants: Object.freeze({
      light: variantTokens(theme.light),
      dark: variantTokens(theme.dark),
    }),
  })
}

/** Initially bundled compatibility themes; more JSON documents can use the same adapter. */
export const BUNDLED_THEMES: readonly ThemeDefinition[] = Object.freeze([
  desktopThemeDefinition(githubDarkColorblindJson as DesktopTheme),
])
