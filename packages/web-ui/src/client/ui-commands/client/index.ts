/**
 * Command UI plugin, browser half: CommandUiRuntime (`ctx.commandUi`) owns both
 * Host slash-command presentation and local application actions. The slash
 * popup mounts by session; the searchable local command palette mounts in the
 * frame overlay and dispatches feature-owned callbacks and keybindings.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the 'conversation.input.overlay' SlotMap declaration (the
// key's owner) into this program so the overlay registration below typechecks
// against the real declaration — no runtime edge to ui-conversation.
import type {} from '@isomoes/dsh-ikanban/client/ui-conversation/client'
import type {} from '@isomoes/dsh-ikanban/client/ui-layout/client'
import type {} from '@isomoes/dsh-ikanban/client/ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@isomoes/dsh-ikanban/client/locale/client'
import { CommandUiRuntime } from './service.ts'
import type { PopupSelectInjected } from './PopupSelectView.tsx'
import { PopupSelectView } from './PopupSelectView.tsx'
import { CommandPaletteView } from './CommandPaletteView.tsx'
import { KeymapSettingsSection } from './KeymapSettingsSection.tsx'
import { en, zh, type CommandKey } from './locales.ts'
import {
  en as settingsEn, zh as settingsZh, type ShortcutSettingsKey,
} from './settings-locales.ts'

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

declare module '@isomoes/dsh-ikanban/client/ui-slots' {
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

/** Required services: command/session services, locale, and profile-backed shortcut settings. */
export const inject = [
  'inputTriggers', 'sessions', 'remote', 'remote.commands', 'locale', 'connection', 'settingsScope',
]

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
    const sessions = scope.sessions
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
