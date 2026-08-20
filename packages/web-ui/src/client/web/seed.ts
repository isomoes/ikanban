/**
 * Platform-singleton module-table. Fetch bundles resolve their platform
 * externals against this table through the module loader's require.
 */
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'
import * as Cordis from '@deepseek-ai/cordis'
import * as UiSlots from '@isomoes/dsh-ikanban/client/ui-slots'
import * as UiPrimitives from '@isomoes/dsh-ikanban/client/ui-primitives'
import type { PlatformModule } from './platform.ts'

/** Build the static table handed to the module loader at boot. */
export function getStaticModules(): Record<string, unknown> {
  return {
    'react': React,
    'react/jsx-runtime': ReactJsxRuntime,
    'react-dom': ReactDom,
    'react-dom/client': ReactDomClient,
    '@deepseek-ai/cordis': Cordis,
    '@isomoes/dsh-ikanban/client/ui-slots': UiSlots,
    '@deepseek-ai/dsh-client-ui-slots': UiSlots,
    '@isomoes/dsh-ikanban/client/ui-primitives': UiPrimitives,
    '@deepseek-ai/dsh-client-ui-primitives': UiPrimitives,
  } satisfies Record<PlatformModule, unknown>
}
