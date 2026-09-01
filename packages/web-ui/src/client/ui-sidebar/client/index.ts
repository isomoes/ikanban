/** Registers the sidebar shell into the layout-owned slot. */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@isomoes/dsh-web-ui/client/locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@isomoes/dsh-web-ui/client/ui-renderer/client'
// Type-only: pulls the Session root standard-props merge.
import type {} from '@isomoes/dsh-web-ui/client/ui-session/client'
import type {} from '@isomoes/dsh-web-ui/client/ui-commands/client'
import type { SidebarRootInjected } from './contract/slots.ts'
import { SidebarRoot } from './SidebarRoot.tsx'
import { en, zh, type SidebarKey } from './locales.ts'

export type {
  SidebarBrandMarkOwnerProps, SidebarBrandNameOwnerProps, SidebarFooterActionOwnerProps,
  SidebarRootComponentProps, SidebarRootInjected, SidebarSectionOwnerProps, SidebarSettingsOwnerProps,
} from './contract/slots.ts'
export type { SidebarKey } from './locales.ts'

declare module '@isomoes/dsh-web-ui/client/ui-slots' {
  interface LocaleNamespaceMap {
    /** Sidebar shell controls copy. */
    sidebar: SidebarKey
  }
}

/** Dictionary namespace owned by this plugin (shell controls copy). */
const NS = 'sidebar'

interface WorkspaceNavigation {
  startSession(workspaceId?: Parameters<SidebarRootInjected['startSession']>[0]): void
}

/** Services required by the sidebar plugin. */
export const inject = ['slots', 'layout', 'uiWorkspace', 'commandUi', 'locale']

/** Registers the sidebar shell and its service callbacks.
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  const workspaceNavigation = ctx.get('uiWorkspace') as unknown as WorkspaceNavigation
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-sidebar: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.commandUi.registerAction({
    id: 'session.new',
    title: () => t('session.new'),
    category: () => 'Sessions',
    keybind: 'ctrl+n',
    ignoreInEditable: true,
    run: () => { workspaceNavigation.startSession() },
  }), 'ui-sidebar: new session shortcut')
  ctx.effect(() => ctx.commandUi.registerAction({
    id: 'sidebar.toggle',
    title: () => t('toggle.collapse'),
    category: () => 'View',
    keybind: 'mod+l',
    ignoreInEditable: true,
    run: () => { ctx.layout.toggleSidebar() },
  }), 'ui-sidebar: toggle shortcut')

  const injectProps = (): SidebarRootInjected => ({
    // The shell's New Session button rides the Workspace UI's shared action
    // (current Session Workspace, then recent Workspace).
    startSession: (workspaceId) => { workspaceNavigation.startSession(workspaceId) },
    toggleSidebar: () => { ctx.layout.toggleSidebar() },
  })
  ctx.effect(
    () => ctx.slots.register({
      name: 'sidebar',
      locale: NS,
      // The shell owns geometry; ui-workspace registers the whole browsing
      // region (header, search, session list, workspace dialogs), ui-settings
      // registers the foot trigger + settings panel.
      children: {
        'sidebar.brand.mark': { kind: 'single', scope: 'root' },
        'sidebar.brand.name': { kind: 'single', scope: 'root' },
        'sidebar.workspaces': { kind: 'single', scope: 'root' },
        'sidebar.settings': { kind: 'single', scope: 'root' },
        'sidebar.footer.action': { kind: 'list', scope: 'root' },
      },
      inject: injectProps,
    }, SidebarRoot),
    'ui-sidebar: slot registration',
  )
}
