import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type UserConfig } from 'tsdown'
import entries from './src/entries.json' with { type: 'json' }
import { isolatedClientConfig } from './src/client/tsdown.client.ts'

const packageRoot = import.meta.dirname
const configs: UserConfig[] = []

for (const [stockId, entry] of Object.entries(entries)) {
  const id = stockId.replace('@deepseek-ai/dsh-client-', '')
  const virtualId = `@isomoes/dsh-ikanban/client/${id}`
  const outDir = resolve(packageRoot, 'lib/clients', id)
  const host = 'host' in entry ? entry.host : undefined
  mkdirSync(outDir, { recursive: true })
  if (host === undefined) {
    writeFileSync(resolve(outDir, 'index.js'), 'export function apply() {}\n')
  } else {
    configs.push({
      name: virtualId,
      entry: { index: resolve(packageRoot, 'src', host) },
      outDir,
      format: 'esm',
      platform: 'node',
      target: 'node22',
      fixedExtension: false,
      dts: false,
      clean: false,
    })
  }
  writeFileSync(resolve(outDir, 'package.json'), `${JSON.stringify({
    name: virtualId,
    type: 'module',
    exports: {
      '.': './index.js',
      './client': './client.js',
      './package.json': './package.json',
    },
    dsh: { client: entry.client },
  }, null, 2)}\n`)
  configs.push(isolatedClientConfig(
    virtualId,
    resolve(packageRoot, 'src', entry.source),
    outDir,
  ))
}

export default defineConfig(configs)
