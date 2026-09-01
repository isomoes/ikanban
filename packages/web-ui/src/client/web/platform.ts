/** Shared browser platform modules for the flattened neutral Web UI. */

/** Canonical module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@isomoes/dsh-web-ui/client/ui-slots',
  '@isomoes/dsh-web-ui/client/ui-primitives',
] as const

/** Client-bundle specifiers whose factories the parser preloads before the shell starts. */
export const PRELOADED_CLIENT_EXTERNALS = [] as const

/** Published upstream words exposing the same locally owned singleton values. */
export const PLATFORM_COMPATIBILITY_ALIASES = {
  '@deepseek-ai/dsh-client-ui-slots': '@isomoes/dsh-web-ui/client/ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives': '@isomoes/dsh-web-ui/client/ui-primitives',
} as const

/** One canonical or compatibility platform module specifier. */
export type PlatformModule =
  | (typeof PLATFORM_MODULES)[number]
  | keyof typeof PLATFORM_COMPATIBILITY_ALIASES
