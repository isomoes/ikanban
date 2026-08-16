/**
 * Platform-singleton module-table. These are the ONLY entities the shell
 * shares into the frozen module table — fetch bundles resolve their externals
 * against exactly this set through the loader's require. Keys come from the
 * platform constant module ({@link ./platform.ts}, the single source
 * of truth with the tsdown client externals); values stay shell-static
 * imports so every bundle sees the same instance.
 */
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'
import * as Cordis from '@deepseek-ai/cordis'
import * as UiSlots from '@isomoes/dsh-ikanban/client/ui-slots'
import * as WebReact from '@isomoes/dsh-ikanban/client/web-react'
import * as UiPrimitives from '@isomoes/dsh-ikanban/client/ui-primitives'
import * as UiAttachment from '@isomoes/dsh-ikanban/client/ui-attachment'
import * as SchemaForm from '@isomoes/dsh-ikanban/client/schema-form'
import type { PlatformModule } from './platform.ts'

/**
 * Build the static table handed to the module loader at boot.
 * @returns module specifier → exported entity (one entry per platform word).
 */
export function getStaticModules(): Record<string, unknown> {
  // The satisfies pin is the projection contract: a word added to
  // PLATFORM_MODULES without a static import here (or vice versa) fails to
  // compile instead of drifting into a runtime require miss.
  return {
    'react': React,
    'react/jsx-runtime': ReactJsxRuntime,
    'react-dom': ReactDom,
    'react-dom/client': ReactDomClient,
    '@deepseek-ai/cordis': Cordis,
    '@isomoes/dsh-ikanban/client/ui-slots': UiSlots,
    // Published DSH infrastructure clients still require these historical
    // contract words. Every alias exposes the exact same locally owned module.
    '@deepseek-ai/dsh-client-ui-slots': UiSlots,
    '@isomoes/dsh-ikanban/client/web-react': WebReact,
    '@deepseek-ai/dsh-client-web-react': WebReact,
    '@isomoes/dsh-ikanban/client/ui-primitives': UiPrimitives,
    '@deepseek-ai/dsh-client-ui-primitives': UiPrimitives,
    '@isomoes/dsh-ikanban/client/ui-attachment': UiAttachment,
    '@deepseek-ai/dsh-client-ui-attachment': UiAttachment,
    '@isomoes/dsh-ikanban/client/schema-form': SchemaForm,
    '@deepseek-ai/dsh-client-schema-form': SchemaForm,
  } satisfies Record<PlatformModule, unknown>
}
