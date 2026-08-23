/** Durable per-workspace defaults for newly created sessions. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by model selection. */
export const WORKSPACE_MODEL_SETTINGS_NAMESPACE = 'ui-workspace-models'

/** Provider/model route inherited by new sessions in one workspace. */
export interface WorkspaceModelDefault {
  provider: string
  model: string
}

/** Workspace ids are dynamic, so the namespace itself is a route dictionary. */
export type WorkspaceModelSettings = Record<string, WorkspaceModelDefault>

/** Durable schema shared by the Host registration and browser settings scope. */
export const WorkspaceModelSettingsSchema: z<WorkspaceModelSettings> = z.dict(z.object({
  provider: z.string(),
  model: z.string(),
})).default({})
