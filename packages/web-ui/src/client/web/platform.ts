/**
 * Shared browser platform modules. Seeding, bundling externals, and Vite
 * aliases consume this list so their module identities cannot drift.
 * @module @isomoes/dsh-ikanban/client/web/platform
 */

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@isomoes/dsh-ikanban/client/ui-slots',
  '@isomoes/dsh-ikanban/client/web-react',
  '@isomoes/dsh-ikanban/client/ui-primitives',
  '@isomoes/dsh-ikanban/client/ui-attachment',
  '@isomoes/dsh-ikanban/client/schema-form',
] as const

/**
 * Compatibility words required by published DSH infrastructure bundles.
 * They resolve to the same local singleton; owned iKanban bundles must use the
 * canonical @isomoes word and therefore do not include these in externals.
 */
export const PLATFORM_COMPATIBILITY_ALIASES = {
  '@deepseek-ai/dsh-client-ui-slots': '@isomoes/dsh-ikanban/client/ui-slots',
} as const

/** One canonical or compatibility platform module specifier. */
export type PlatformModule =
  | (typeof PLATFORM_MODULES)[number]
  | keyof typeof PLATFORM_COMPATIBILITY_ALIASES
