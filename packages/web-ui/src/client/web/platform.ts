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

/** One platform module specifier (a seed-table key). */
export type PlatformModule = (typeof PLATFORM_MODULES)[number]
