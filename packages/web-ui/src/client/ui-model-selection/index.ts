/** Model selection Host half: register durable per-workspace model defaults. */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  WORKSPACE_MODEL_SETTINGS_NAMESPACE, WorkspaceModelSettingsSchema,
} from './workspace-model-settings.ts'

export {
  WORKSPACE_MODEL_SETTINGS_NAMESPACE, type WorkspaceModelDefault, type WorkspaceModelSettings,
} from './workspace-model-settings.ts'
export { WorkspaceModelDefaults } from './workspace-defaults.ts'
export type { WorkspaceDefaultContext } from './workspace-defaults.ts'

const WORKSPACE_MODELS_NAMESPACE = settingsNamespace(WORKSPACE_MODEL_SETTINGS_NAMESPACE)

/** Register the settings section when the optional Host settings service exists. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(WORKSPACE_MODELS_NAMESPACE, WorkspaceModelSettingsSchema)
  })
}
