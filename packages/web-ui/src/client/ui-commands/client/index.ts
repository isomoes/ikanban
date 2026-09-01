/**
 * Command UI plugin, browser half: CommandUiRuntime (`ctx.commandUi`) owning the
 * capability-keyed directory cache, the '/' command source, the client
 * contribution registry, and the per-session popupSelect controllers; the
 * popupSelect shell self-registers into conversation.input.overlay with
 * per-session resolution.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: pulls the 'conversation.input.overlay' SlotMap declaration (the
// key's owner) into this program so the overlay registration below typechecks
// against the real declaration — no runtime edge to ui-conversation.
import type {} from '@isomoes/dsh-web-ui/client/ui-conversation/client'
import type {} from '@isomoes/dsh-web-ui/client/ui-layout/client'
import type {} from '@isomoes/dsh-web-ui/client/ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@isomoes/dsh-web-ui/client/locale/client'
import type {} from '@isomoes/dsh-web-ui/client/ui-renderer/client'
import type {} from '@isomoes/dsh-web-ui/client/ui-session/client'
import { CommandUiRuntime } from './service.ts'
import type { PopupSelectInjected } from './PopupSelectView.tsx'
import { PopupSelectView } from './PopupSelectView.tsx'
import { CommandPaletteView } from './CommandPaletteView.tsx'
import { KeymapSettingsSection } from './KeymapSettingsSection.tsx'
import { en, zh, type CommandKey } from './locales.ts'
import { en as settingsEn, zh as settingsZh, type ShortcutSettingsKey } from './settings-locales.ts'

export { CommandUiRuntime } from './service.ts'
export { CommandDirectory } from './directory.ts'
export type { CommandDescriptor, DirectoryStatus } from './directory.ts'
export { filterOptions, PopupSelectController } from './popup.ts'
export type { PopupSelectDeps, PopupSpec, PopupState, TokenSegment } from './popup.ts'
export type { PopupSelectInjected, PopupSelectViewProps } from './PopupSelectView.tsx'
export type {
  CommandContribution, CommandDecoration, CommandUiContract, CommandUiSpec, SelectConfirmation, SelectOption,
} from './contract.ts'
export type { CommandKey } from './locales.ts'
export {
  COMMAND_PALETTE_ACTION_ID, UiActionRegistry, filterUiActions, formatKeybind, keybindFromEvent, matchKeybind,
  parseKeybind,
} from './actions.ts'
export type { ParsedKeybind, UiAction, UiActionSource } from './actions.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    commandUi: CommandUiRuntime
  }
}

declare module '@isomoes/dsh-web-ui/client/ui-slots' {
  interface LocaleNamespaceMap {
    /** The popupSelect shell's copy. */
    command: CommandKey
    /** Keyboard-shortcut settings copy. */
    'settings.shortcuts': ShortcutSettingsKey
  }
}

/** Dictionary namespaces owned by this plugin. */
const NS = 'command'
const SETTINGS_NS = 'settings.shortcuts'

/** Required services: the '/' source registry, session scopes, commands Remote, and locale registry. */
export const inject = ['inputTriggers', 'sessions', 'remote', 'remote.commands', 'locale', 'settingsScope']

/**
 * Client plugin body: mount the service, then register the popupSelect shell
 * into the input overlay once its declarer is up.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-commands: dictionaries')
  ctx.effect(
    () => ctx.locale.register(SETTINGS_NS, { zh: settingsZh, en: settingsEn }),
    'ui-commands: shortcut settings dictionaries',
  )
  ctx.plugin(CommandUiRuntime)
  ctx.inject(['slots', 'commandUi'], (scope: ClientContext) => {
    scope.slots.inject('shell.overlay', () => scope.slots.register({
      name: 'shell.overlay',
      id: 'command-palette',
      order: 0,
      locale: NS,
      inject: () => ({ actions: scope.commandUi.actions }),
    }, CommandPaletteView))
    const settingsT = scope.locale.bind(SETTINGS_NS)
    scope.slots.inject('settings.section', () => scope.slots.register({
      name: 'settings.section',
      id: 'shortcuts',
      order: 5,
      label: () => settingsT('nav'),
      locale: SETTINGS_NS,
      inject: () => ({ commandUi: scope.commandUi }),
    }, KeymapSettingsSection))
  })
  ctx.inject(['slots', 'commandUi', 'sessions'], (scope: ClientContext) => {
    const command = scope.commandUi
    const sessions = scope.get('sessions') as ISessions
    scope.slots.inject('conversation.input.overlay', () => scope.slots.register({
      name: 'conversation.input.overlay',
      id: 'command-popup',
      order: 1,
      locale: NS,
      inject: (sessionId): PopupSelectInjected => {
        const actx = sessions.scope(sessionId)
        if (actx === undefined) throw new Error(`ui-commands: session "${String(sessionId)}" resolved no scope`)
        return { popup: command.popupFor(actx) }
      },
    }, PopupSelectView))
  })
}
