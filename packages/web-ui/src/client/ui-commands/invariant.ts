/**
 * Package-owned invariant companion for `@isomoes/dsh-ikanban/client/ui-commands`.
 * @module @isomoes/dsh-ikanban/client/ui-commands/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@isomoes/dsh-ikanban/client/ui-commands'

/** Cordis companion plugin name. */
export const name = 'client-ui-commands-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the browser-side slash directory and local action
 * registry emit no Cordis events; dispatch, keybinding, and cache behavior are
 * asserted by this package's specs.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
