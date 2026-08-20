/**
 * Workspace plugin, browser half. Two registrations: WorkspaceBrowser fills
 * the sidebar shell's `sidebar.workspaces` hole (the whole browsing region),
 * and WorkspacePicker fills the conversation hero's picker hole
 * (`conversation.hero.workspace` — both hero forms). Both read real Host
 * Workspaces through the global useWorkspaces hook, and each declares its
 * own `single` directory-flow child hole for the composed picker package's
 * client half (see the contract module doc). Export discipline:
 * packages/client/AGENTS.md.
 */
import type { HostObservable } from '@isomoes/dsh-ikanban/client/ui-slots'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the owned locale, command, and conversation Context merges.
import type {} from '@isomoes/dsh-ikanban/client/locale/client'
import type {} from '@isomoes/dsh-ikanban/client/ui-commands/client'
import type {} from '@isomoes/dsh-ikanban/client/ui-conversation/client'
import type { WorkspaceChanges } from '../workspace-changes.ts'
import type { WorkspaceBrowserInjected, WorkspacePickerInjected } from './contract/slots.ts'
import { createWorkspaceViewStore } from './stores.ts'
import { WorkspaceBrowser } from './WorkspaceBrowser.tsx'
import { WorkspacePicker } from './WorkspacePicker.tsx'
import { WorkspaceChangesView, type WorkspaceChangesViewInjected } from './WorkspaceChangesView.tsx'
import { en, zh, type WorkspaceKey } from './locales.ts'
import { nextSessionAfterArchive } from '../session-navigation.ts'

export type {
  DirectoryFlowOwnerProps, DirectoryFlowSlotName, DirectoryPickingHooks, DirectoryPickingInjected,
  WorkspaceBrowserInjected, WorkspaceBrowserProps, WorkspacePickerInjected, WorkspacePickerProps,
} from './contract/slots.ts'
export type { WorkspaceKey } from './locales.ts'

declare module '@isomoes/dsh-ikanban/client/ui-slots' {
  interface LocaleNamespaceMap {
    /** The workspace browsing region and pick/create flow copy. */
    workspace: WorkspaceKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'workspace'
const WORKSPACE_FILE_CHANNEL = '/ikanban.workspace-files'

/**
 * Required services (cordis fiber inject). The target slots are declared by
 * the ui-sidebar / ui-conversation applies, whose activation order relative
 * to this one is NOT constrained: dsh.client.inject edges are informational
 * (loading/prefetch metadata, never apply sequencing) and neither owner
 * provides a waitable service. apply therefore depends on each slot
 * declaration through `slots.inject()` instead of assuming order.
 */
export const inject = ['slots', 'sessions', 'workspaces', 'locale', 'connection', 'commandUi']

/**
 * Register the browser and picker once their slot declarations are on the
 * ledger. Inject factories return plain callbacks; data reads use the
 * framework's global hooks.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  const hostDescription = connection.hostDescription
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workspace: dictionaries')
  const t = ctx.locale.bind(NS)
  const archiveSession = async (sessionId: SessionId): Promise<void> => {
    const before = ctx.sessions.list.getSnapshot()
    const next = before.current === sessionId
      ? nextSessionAfterArchive(before, ctx.workspaces.list.getSnapshot().archivedSessionIds, sessionId)
      : undefined
    await ctx.workspaces.archiveSession(sessionId)
    if (next === undefined) return

    // The archive projection normally clears the current selection before the
    // request resolves. Do not override a Session the user opened meanwhile.
    const after = ctx.sessions.list.getSnapshot()
    if (after.current !== undefined && after.current !== sessionId) return
    const candidate = after.byId[next]
    const archived = ctx.workspaces.list.getSnapshot().archivedSessionIds
    if (candidate === undefined || candidate.blank || candidate.origin === 'subagent' || archived.includes(next)) return
    ctx.sessions.open(next)
  }
  ctx.effect(() => ctx.commandUi.registerAction({
    id: 'session.archive',
    title: () => t('menu.archiveSession'),
    category: () => t('section.sessions'),
    keybind: 'ctrl+a',
    disabled: () => {
      const sessions = ctx.sessions.list.getSnapshot()
      const current = sessions.current
      const session = current === undefined ? undefined : sessions.byId[current]
      return session === undefined || session.blank || session.origin === 'subagent'
    },
    run: async () => {
      const sessions = ctx.sessions.list.getSnapshot()
      const current = sessions.current
      const session = current === undefined ? undefined : sessions.byId[current]
      if (current === undefined || session === undefined || session.blank || session.origin === 'subagent') return
      await archiveSession(current)
    },
  }), 'ui-workspace: archive action')

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'changes',
    order: 20,
    locale: NS,
    label: () => t('changes.view'),
    inject: (sessionId: SessionId): WorkspaceChangesViewInjected => ({
      loadChanges: async (signal) => {
        const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
        if (cwd === undefined || cwd === '') throw new Error('Session has no workspace')
        const result = await connection.rpc.call(WORKSPACE_FILE_CHANNEL, 'changes', { cwd }, signal)
        if (!result.ok) throw new Error(result.error.message)
        return result.value as WorkspaceChanges
      },
    }),
  }, WorkspaceChangesView))
  // rc.8's ui-reference owns the unified @ source (files and sessions).
  // Keep this package from registering a second local file provider, which
  // would duplicate candidates while preserving file autocomplete through
  // that reference contract.

  const searchSessions: WorkspaceBrowserInjected['searchSessions'] = async (query, signal) => {
    const result = await ctx.sessions.search(query, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }
  const currentWorkspace = () => {
    const current = ctx.sessions.list.getSnapshot().current
    if (current === undefined) return undefined
    return ctx.workspaces.list.getSnapshot().items.find(workspace => workspace.sessionIds.includes(current))
  }
  const registerDeleteAction: WorkspaceBrowserInjected['registerDeleteAction'] = open => ctx.commandUi.registerAction({
    id: 'workspace.delete',
    title: () => t('delete.workspace'),
    category: () => t('section.workspaces'),
    disabled: () => currentWorkspace() === undefined,
    run: () => {
      const workspace = currentWorkspace()
      if (workspace !== undefined) open({ workspaceId: workspace.workspaceId, title: workspace.title })
    },
  })

  // Stable per-surface occupancy sources (the renderer's hook cache keys by
  // source identity): true while the surface's directory-flow hole is filled.
  const flowSource = (hole: 'sidebar.workspaces.directoryFlow' | 'conversation.hero.workspace.directoryFlow'): HostObservable<boolean> => ({
    getSnapshot: () => ctx.slots.entries(hole).length > 0,
    subscribe: listener => ctx.slots.subscribe(hole, listener),
  })
  const browserFlowSource = flowSource('sidebar.workspaces.directoryFlow')
  const pickerFlowSource = flowSource('conversation.hero.workspace.directoryFlow')
  const browserInjected = (): WorkspaceBrowserInjected => ({
    // Explicit group actions keep their target; unscoped New Session inherits
    // the current Session Workspace before the recent-Workspace fallback.
    startSession: (workspaceId) => { ctx.workspaces.startSession(workspaceId) },
    open: (sessionId) => { ctx.sessions.open(sessionId) },
    searchSessions,
    searchResultLimit: ctx.sessions.searchResultLimit,
    renameSession: async (sessionId, title) => {
      // Row → session-face hop: rename is a per-session verb (ISession), not
      // a list-service verb; the binding resolves any listed session.
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
      const result = await session.rename(title)
      if (!result.ok) throw new Error(result.error.message)
    },
    forkSession: (sessionId) => {
      ctx.sessions.fork({ sessionId, increaseTitle: true })
        .then((childId) => { ctx.sessions.open(childId) })
        .catch(() => {
          // Fork or child-rename failure keeps the current selection.
        })
    },
    renameWorkspace: async (workspaceId, title) => { await ctx.workspaces.rename(workspaceId, title) },
    deleteWorkspace: async (workspaceId) => { await ctx.workspaces.delete(workspaceId) },
    registerDeleteAction,
    insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
      await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId)
    },
    archiveSession,
    insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
      await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
    },
    createWorkspace: input => ctx.workspaces.create(input),
    hooks: { directoryFlow: browserFlowSource, hostDescription },
  })
  const pickerInjected = (): WorkspacePickerInjected => ({
    createWorkspace: input => ctx.workspaces.create(input),
    hooks: { directoryFlow: pickerFlowSource },
  })
  // Each registration declares its directory-flow child in the same call;
  // slot injection follows both the owner and declaration HMR lifetimes.
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces',
      children: { 'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' } },
      store: createWorkspaceViewStore(),
      inject: browserInjected,
      locale: NS,
    },
    WorkspaceBrowser,
  ))
  ctx.slots.inject('conversation.hero.workspace', () => ctx.slots.register(
    {
      name: 'conversation.hero.workspace',
      children: { 'conversation.hero.workspace.directoryFlow': { kind: 'single', scope: 'root' } },
      inject: pickerInjected,
      locale: NS,
    },
    WorkspacePicker,
  ))
}
