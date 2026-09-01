/** iKanban wrapper over the published DSH Web runtime. */
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-shell-env'
import * as WebApp from '@deepseek-ai/dsh-web-app'

export const name = WebApp.name
export const inject = WebApp.inject
export const Config = WebApp.Config
export type Config = WebApp.Config
export type WebRuntimeValues = WebApp.WebRuntimeValues
export const resolveLanTrust = WebApp.resolveLanTrust

const LOOPBACK_HOST = '127.0.0.1'

function localWebUrl(ctx: Context): string {
  const port = ctx.get('webServer')?.port
  if (port === undefined) throw new Error('ikanban: webServer service missing while resolving Web runtime')
  return `http://${LOOPBACK_HOST}:${String(port)}`
}

function resolveDistIndex(): string {
  return fileURLToPath(new URL('./web/index.html', import.meta.url))
}

/** Test hook and product-owned frontend resolver. */
export const internals: { resolveDistIndex: () => string } = { resolveDistIndex }

/**
 * Run the maintained upstream Web runtime against iKanban's packaged frontend.
 * iKanban deliberately suppresses the model-visible Web surface prompt while
 * retaining the shell-visible DSH_WEB_URL variable.
 */
export function apply(ctx: Context, config: Config): void {
  const previousResolver = WebApp.internals.resolveDistIndex
  WebApp.internals.resolveDistIndex = () => internals.resolveDistIndex()
  try {
    WebApp.apply(ctx, { ...config, surfaceContext: false })
  } finally {
    WebApp.internals.resolveDistIndex = previousResolver
  }

  if (!config.surfaceContext) return
  ctx.inject(['shellEnv'], (runtimeCtx) => {
    runtimeCtx.shellEnv.register({
      name: 'web-runtime',
      variables: {
        DSH_WEB_URL: { description: 'Canonical local URL of the iKanban Web GUI serving this session.' },
      },
      resolve: () => ({ DSH_WEB_URL: localWebUrl(runtimeCtx) }),
    })
  })
}
