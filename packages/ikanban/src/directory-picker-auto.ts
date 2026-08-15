import { accessSync, constants } from 'node:fs'
import { delimiter, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { Config as HttpServerConfig } from '@deepseek-ai/dsh-host-webserver'

export type DirectoryPickerBackendKind = 'native' | 'browse'

export type DirectoryPickerEnv = Readonly<
  Partial<Record<'SSH_CONNECTION' | 'SSH_TTY' | 'DISPLAY' | 'WAYLAND_DISPLAY', string>>
>

export interface DirectoryPickerHostFacts {
  bindHost: HttpServerConfig['host']
  platform: NodeJS.Platform
  env: DirectoryPickerEnv
  linuxChooser: boolean
}

const LINUX_CHOOSER_BINARIES = ['zenity', 'kdialog'] as const
const present = (value: string | undefined): boolean => value !== undefined && value !== ''

export function canExecute(candidate: string): boolean {
  try {
    accessSync(candidate, constants.X_OK)
  } catch {
    return false
  }
  return true
}

export function hasLinuxChooserBinary(
  pathValue: string | undefined,
  isExecutable: (candidate: string) => boolean,
): boolean {
  for (const dir of (pathValue ?? '').split(delimiter)) {
    if (dir === '') continue
    for (const name of LINUX_CHOOSER_BINARIES) {
      if (isExecutable(join(dir, name))) return true
    }
  }
  return false
}

export function resolveDirectoryPickerBackend(facts: DirectoryPickerHostFacts): DirectoryPickerBackendKind {
  if (facts.bindHost !== '127.0.0.1') return 'browse'
  if (present(facts.env.SSH_CONNECTION) || present(facts.env.SSH_TTY)) return 'browse'
  if (facts.platform === 'darwin' || facts.platform === 'win32') return 'native'
  if (facts.platform !== 'linux' || !facts.linuxChooser) return 'browse'
  return present(facts.env.DISPLAY) || present(facts.env.WAYLAND_DISPLAY) ? 'native' : 'browse'
}

export const name = 'directory-picker-auto'
export const inject = ['webServer', 'loader']

export const BACKEND_PACKAGES: Record<DirectoryPickerBackendKind, string> = {
  native: '@deepseek-ai/dsh-host-directory-picker-native',
  browse: '@deepseek-ai/dsh-host-directory-picker-browse',
}

export const SURFACE_PACKAGES: Record<DirectoryPickerBackendKind, string> = {
  native: '@isomoes/dsh-ikanban/client/ui-directory-picker-native',
  browse: '@isomoes/dsh-ikanban/client/ui-directory-picker-browse',
}

export async function apply(ctx: Context): Promise<void> {
  const backend = resolveDirectoryPickerBackend({
    bindHost: ctx.webServer.host,
    platform: process.platform,
    env: process.env,
    linuxChooser: hasLinuxChooserBinary(process.env.PATH, canExecute),
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
