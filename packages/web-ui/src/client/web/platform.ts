/**
 * Shared browser platform modules. Seeding, bundling externals, and Vite
 * aliases consume this list so their module identities cannot drift.
 * @module @isomoes/dsh-web-ui/client/web/platform
 */

/** Canonical module specifiers the shell shares into the module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@isomoes/dsh-web-ui/client/ui-slots',
  '@isomoes/dsh-web-ui/client/ui-primitives',
] as const

/** Client-bundle specifiers whose factories the parser preloads before the shell starts. */
export const PRELOADED_CLIENT_EXTERNALS = [
  '@deepseek-ai/dsh-client-runtime/client',
] as const

/**
 * Compatibility words required by published DSH bundles. They expose the same
 * local singleton while iKanban-owned bundles retain their canonical ids.
 */
export const PLATFORM_COMPATIBILITY_ALIASES = {
  '@deepseek-ai/dsh-client-ui-slots': '@isomoes/dsh-web-ui/client/ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives': '@isomoes/dsh-web-ui/client/ui-primitives',
} as const

/** One canonical or compatibility platform module specifier. */
export type PlatformModule =
  | (typeof PLATFORM_MODULES)[number]
  | keyof typeof PLATFORM_COMPATIBILITY_ALIASES
