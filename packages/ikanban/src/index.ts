import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import * as FrontendStatic from '@deepseek-ai/dsh-host-frontend-static'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-shell-env'

export const name = 'web-app'
export const inject = ['webServer']

export interface Config {
  printUrl: boolean
  surfaceContext: boolean
  trustedHosts: string[]
}

export const Config: z<Config> = z.object({
  printUrl: z.boolean().default(true),
  surfaceContext: z.boolean().default(true),
  trustedHosts: z.array(String).default([]),
})

export interface WebRuntimeValues {
  lanAddresses: string[]
  trustedHosts: string[]
}

const LOOPBACK_HOST = '127.0.0.1'
const ALL_INTERFACES_HOST = '0.0.0.0'

export function resolveLanTrust(bindHost: string, extra: readonly string[]): WebRuntimeValues {
  const lanAddresses = bindHost === ALL_INTERFACES_HOST
    ? Object.values(networkInterfaces()).flat()
      .filter((iface): iface is NonNullable<typeof iface> => iface !== undefined && iface.family === 'IPv4' && !iface.internal)
      .map(iface => iface.address)
    : []
  return { lanAddresses, trustedHosts: [...lanAddresses, ...extra] }
}

function localWebUrl(ctx: Context): string {
  const port = ctx.get('webServer')?.port
  if (port === undefined) throw new Error('ikanban: webServer service missing while resolving Web runtime')
  return `http://${LOOPBACK_HOST}:${String(port)}`
}

function resolveDistIndex(): string {
  return fileURLToPath(new URL('./web/index.html', import.meta.url))
}

export const internals: { resolveDistIndex: () => string } = { resolveDistIndex }

export function apply(ctx: Context, config: Config): void {
  const runtime = resolveLanTrust(ctx.webServer.host, config.trustedHosts)
  ctx.provide('webRuntime', runtime)
  ctx.plugin(FrontendStatic, {
    distIndex: internals.resolveDistIndex(),
  })

  if (config.surfaceContext) {
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

  if (!config.printUrl) return
  const printUrl = (): void => {
    const lanCandidate = runtime.lanAddresses[0]
    const port = ctx.webServer.port
    console.log(`dsh web: ${localWebUrl(ctx)}${lanCandidate === undefined ? '' : ` (LAN: http://${lanCandidate}:${String(port)})`}`)
  }
  const settled = ctx.get('loader')?.await()
  if (settled === undefined) printUrl()
  else void settled.then(() => {
    if (ctx.get('webServer') !== undefined) printUrl()
  }, () => {})
}
