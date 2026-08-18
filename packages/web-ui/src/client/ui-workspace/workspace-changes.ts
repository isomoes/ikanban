/** Wire model for the workspace changes conversation view. */

export type WorkspaceChangeStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'conflicted' | 'untracked'

export interface WorkspaceChange {
  /** Workspace-relative path after the change. */
  readonly path: string
  /** Original path for a rename. */
  readonly previousPath?: string
  readonly status: WorkspaceChangeStatus
  /** Unified diff for this file, bounded by the host. */
  readonly patch: string
}

export interface WorkspaceChanges {
  /** False when the selected directory is not a Git work tree. */
  readonly repository: boolean
  readonly files: readonly WorkspaceChange[]
  /** The host omitted some diff text after reaching its response cap. */
  readonly truncated: boolean
}
