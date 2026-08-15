import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type UserConfig } from 'tsdown'
import entries from './src/entries.json' with { type: 'json' }
import { isolatedClientConfig } from './src/upstream/packages/client/tsdown.client.ts'

const packageRoot = import.meta.dirname
const configs: UserConfig[] = []

for (const [stockId, entry] of Object.entries(entries)) {
  const id = stockId.replace('@deepseek-ai/dsh-client-', '')
  const virtualId = `@isomoes/dsh-ikanban/client/${id}`
  const outDir = resolve(packageRoot, 'lib/clients', id)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'index.js'), 'export function apply() {}\n')
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
    resolve(packageRoot, 'src/upstream', entry.source),
    outDir,
  ))
}

export default defineConfig(configs)
