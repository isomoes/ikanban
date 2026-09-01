/**
 * ModelDirectoryResolver (`ctx.modelDirectories`): the root owner of per-session
 * {@link ModelDirectory} instances. Both selection entries (the /model popup
 * and the composer model seat) resolve their session's directory through
 * this service, which is what makes the dual entry one shared state.
 *
 * Per-session storage follows the client service pattern (InputTriggerService /
 * CommandUiRuntime): a lazy service-internal map whose entry is deleted by the
 * owning scope's disposer. The host `dsh-scope` ScopedLayers registry does
 * does not belong here: it derives scope from the host carrier mechanism
 * (object-keyed), while client scopes tag contexts with branded SessionId
 * strings, and it models global+shadow named registries — this is a
 * per-session singleton with no global layer to merge.
 */
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type { ModelSelection } from '@deepseek-ai/dsh-api-session-controller/types'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { SettingsScope } from '@isomoes/dsh-web-ui/client/ui-settings/client'
import {
  WORKSPACE_MODEL_SETTINGS_NAMESPACE, type WorkspaceModelSettings,
} from '../workspace-model-settings.ts'
import { WorkspaceModelDefaults } from '../workspace-defaults.ts'
import { ModelCatalogDirectory } from './catalog.ts'
import { ModelDirectory } from './directory.ts'
import type { ModelDirectoryState } from './directory.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    modelDirectories: ModelDirectoryResolver
  }
}

/** Live mutable state in one holder (service methods run behind the caller-ctx tracker). */
interface LiveState {
  /** Per-session directories; entries are deleted by their scope disposer. */
  readonly directories: Map<SessionId, ModelDirectory>
  /** Last workspace default applied to each blank session. */
  readonly appliedDefaults: Map<SessionId, string>
}

function selectionKey(selection: Pick<ModelSelection, 'provider' | 'model'>): string {
  return JSON.stringify([selection.provider, selection.model])
}

/** The `ctx.modelDirectories` session model-selection service. */
export class ModelDirectoryResolver extends Service {
  static inject = ['sessions', 'workspaces', 'remote', 'remote.session', 'settingsScope']

  private readonly live: LiveState = { directories: new Map(), appliedDefaults: new Map() }
  private readonly catalog: ModelCatalogDirectory
  private readonly defaults: WorkspaceModelDefaults

  /** Localized composer-block copy; this plugin owns the string it raises. */
  private readonly blockReason: () => string

  /**
   * @param ctx - owning root context (the service registers itself as `models`).
   * @param config - the bound translator for this plugin's own dictionary.
   */
  constructor(ctx: Context, config: { blockReason: () => string }) {
    super(ctx, 'modelDirectories')
    this.blockReason = config.blockReason
    const settings = ctx.settingsScope.bind<WorkspaceModelSettings>({
      namespace: WORKSPACE_MODEL_SETTINGS_NAMESPACE,
    }) as SettingsScope<WorkspaceModelSettings>
    this.defaults = new WorkspaceModelDefaults(settings, {
      workspaceForSession: (sessionId): WorkspaceId | undefined =>
        ctx.workspaces.list.getSnapshot().items.find(workspace => workspace.sessionIds.includes(sessionId))?.workspaceId,
      sessionIsBlank: sessionId => ctx.sessions.list.getSnapshot().byId[sessionId]?.blank === true,
    })
    ctx.effect(() => this.defaults.subscribe(() => {
      for (const [sessionId, directory] of this.live.directories) {
        void this.applyWorkspaceDefault(sessionId, directory)
      }
    }), 'ui-model-selection: workspace defaults')
    this.catalog = new ModelCatalogDirectory(ctx)
    void this.catalog.load().catch(() => { /* selectors expose the shared error */ })
    ctx.on('connection/reset', () => {
      this.catalog.resetGeneration()
      for (const directory of this.live.directories.values()) directory.resetConnected()
    })
    ctx.remote.$on('llm/adapters-updated', () => { this.catalog.refresh() })
    ctx.remote.$on('settings/document-updated', () => { this.catalog.refresh() })
    ctx.remote.$on('credentials/reference-updated', () => { this.catalog.refresh() })
  }

  /** Load a session directory, then inherit its workspace route while it is blank. */
  async load(sessionId: SessionId): Promise<ModelDirectoryState> {
    const directory = this.directoryFor(sessionId)
    await directory.load()
    await this.applyWorkspaceDefault(sessionId, directory).catch(() => undefined)
    return directory.store.getSnapshot()
  }

  /** Select for one session; a blank session also establishes its workspace's future default. */
  async select(sessionId: SessionId, selection: ModelSelection): Promise<void> {
    const directory = this.directoryFor(sessionId)
    await directory.select(selection)
    this.live.appliedDefaults.set(sessionId, selectionKey(selection))
    await this.defaults.remember(sessionId, selection)
  }

  /** Apply one durable workspace route at most once per blank-session/default pair. */
  private async applyWorkspaceDefault(sessionId: SessionId, directory: ModelDirectory): Promise<void> {
    const preferred = this.defaults.preferredFor(sessionId)
    if (preferred === undefined) return
    const key = selectionKey(preferred)
    if (this.live.appliedDefaults.get(sessionId) === key) return
    const current = directory.store.getSnapshot().current
    if (current?.provider === preferred.provider && current.model === preferred.model) {
      this.live.appliedDefaults.set(sessionId, key)
      return
    }
    this.live.appliedDefaults.set(sessionId, key)
    try {
      await directory.select(preferred)
    } catch (error) {
      if (this.live.appliedDefaults.get(sessionId) === key) this.live.appliedDefaults.delete(sessionId)
      throw error
    }
  }

  /**
   * Resolve the per-session shared directory (lazy; the scope disposer
   * removes and disposes it). Unknown sessions fail loud.
   * @param sessionId - the owning session.
   * @returns the resident directory both entries share.
   */
  directoryFor(sessionId: SessionId): ModelDirectory {
    const { live } = this
    const existing = live.directories.get(sessionId)
    if (existing !== undefined) return existing
    const sessions = this.ctx.sessions
    const actx = sessions.scope(sessionId)
    if (actx === undefined) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no scope`)
    const binding = sessions.binding(sessionId)
    if (binding === undefined) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no binding`)
    const directory = new ModelDirectory(
      this.ctx.remote.session,
      sessionId,
      () => sessions.subagentAddress(sessionId) === undefined,
      this.catalog,
      binding.session.projections.faceOf('modelSelection'),
    )
    live.directories.set(sessionId, directory)
    // The composer cannot read this plugin (the dependency runs one way), so
    // the block is pushed: the Host says whether an adapter serves the
    // session's route, and only a definite `false` makes the input inert.
    // `null` — before the first load, or after one failed — must not, or a
    // slow or unreachable Host would lock a working composer.
    const conversation = this.ctx.get('conversation')
    if (conversation !== undefined) {
      const publish = (): void => {
        conversation.blocks.set(sessionId, directory.store.getSnapshot().routable === false
          ? { reason: this.blockReason() }
          : undefined)
      }
      publish()
      actx.effect(() => {
        const stop = directory.store.subscribe(publish)
        return () => {
          stop()
          conversation.blocks.set(sessionId, undefined)
        }
      }, 'ui-model-selection: composer block')
    }
    actx.effect(() => () => {
      directory.dispose()
      live.directories.delete(sessionId)
      live.appliedDefaults.delete(sessionId)
    }, 'ui-model-selection: session directory')
    return directory
  }
}
