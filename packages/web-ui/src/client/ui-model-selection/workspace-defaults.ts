/** Workspace-scoped model defaults used only while a session is blank. */

import type { ModelSelection, SessionId, WorkspaceId } from '@deepseek-ai/dsh-api-remotes/client'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  WorkspaceModelDefault, WorkspaceModelSettings,
} from './workspace-model-settings.ts'

/** Minimal workspace/session projection needed to resolve inheritance. */
export interface WorkspaceDefaultContext {
  workspaceForSession: (sessionId: SessionId) => WorkspaceId | undefined
  sessionIsBlank: (sessionId: SessionId) => boolean
}

/** Owns durable workspace-route reads and writes without changing existing sessions. */
export class WorkspaceModelDefaults {
  constructor(
    private readonly settings: SettingsScope<WorkspaceModelSettings>,
    private readonly context: WorkspaceDefaultContext,
  ) {}

  /** Observe changes from this tab or another settings writer. */
  subscribe(listener: () => void): () => void {
    return this.settings.subscribe(listener)
  }

  /** Return the inherited route only for a blank session in a registered workspace. */
  preferredFor(sessionId: SessionId): WorkspaceModelDefault | undefined {
    if (!this.context.sessionIsBlank(sessionId)) return undefined
    const workspaceId = this.context.workspaceForSession(sessionId)
    if (workspaceId === undefined) return undefined
    return this.settings.getSnapshot().value?.[workspaceId]
  }

  /** Remember an explicit blank-session choice as this workspace's future default. */
  async remember(sessionId: SessionId, selection: ModelSelection): Promise<void> {
    if (!this.context.sessionIsBlank(sessionId)) return
    const workspaceId = this.context.workspaceForSession(sessionId)
    if (workspaceId === undefined) return
    await this.settings.set(workspaceId, {
      provider: selection.provider,
      model: selection.model,
    } satisfies WorkspaceModelDefault)
  }
}
