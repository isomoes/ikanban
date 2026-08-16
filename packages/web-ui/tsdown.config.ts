import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type UserConfig } from 'tsdown'
import { discoverClientEntries } from './build/client-entries.js'
import { isolatedClientConfig } from './src/client/tsdown.client.ts'

const packageRoot = import.meta.dirname
const entries = await discoverClientEntries({ packageRoot })
const configs: UserConfig[] = []

for (const entry of entries) {
  const { id, virtualId, host } = entry
  const outDir = resolve(packageRoot, 'lib/clients', id)
  mkdirSync(outDir, { recursive: true })
  if (host === undefined) {
    writeFileSync(resolve(outDir, 'index.js'), 'export function apply() {}\n')
  } else {
    configs.push({
      name: virtualId,
      entry: { index: host },
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
    entry.source,
    outDir,
  ))
}

export default defineConfig(configs)
