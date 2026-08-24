import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { Config as HttpServerConfig } from '@deepseek-ai/dsh-host-webserver'

export type DirectoryPickerBackendKind = 'browse'

export type DirectoryPickerEnv = Readonly<
  Partial<Record<'SSH_CONNECTION' | 'SSH_TTY' | 'DISPLAY' | 'WAYLAND_DISPLAY', string>>
>

export interface DirectoryPickerHostFacts {
  bindHost: HttpServerConfig['host']
  platform: NodeJS.Platform
  env: DirectoryPickerEnv
  linuxChooser: boolean
}

export function resolveDirectoryPickerBackend(_facts: DirectoryPickerHostFacts): DirectoryPickerBackendKind {
  return 'browse'
}

export const name = 'directory-picker-auto'
export const inject = ['webServer', 'loader']

export const BACKEND_PACKAGES: Record<DirectoryPickerBackendKind, string> = {
  browse: '@deepseek-ai/dsh-host-directory-picker-browse',
}

export const SURFACE_PACKAGES: Record<DirectoryPickerBackendKind, string> = {
  browse: '@isomoes/dsh-web-ui/client/ui-directory-picker-browse',
}

export async function apply(ctx: Context): Promise<void> {
  const backend = resolveDirectoryPickerBackend({
    bindHost: ctx.webServer.host,
    platform: process.platform,
    env: process.env,
    linuxChooser: false,
  })
  await ctx.effect(async () => {
    const ids: string[] = []
    const unmount = async () => {
      for (const id of [...ids].reverse()) {
        if (ctx.loader.store[id] === undefined) continue
        await ctx.loader.remove(id)
      }
    }
    try {
      for (const packageName of [BACKEND_PACKAGES[backend], SURFACE_PACKAGES[backend]]) {
        ids.push(await ctx.loader.create({ name: packageName }))
      }
    } catch (cause) {
      await unmount()
      throw cause
    }
    return unmount
  }, 'directory-picker-auto: interaction entries')
}
