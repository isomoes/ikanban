import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsdown'
import { isolatedClientConfig } from '../web-ui/src/client/tsdown.client.ts'

const id = '@isomoes/dsh-ikanban/client/ui-brand-ikanban'
const outDir = resolve(import.meta.dirname, 'lib/clients/ui-brand-ikanban')
mkdirSync(outDir, { recursive: true })
writeFileSync(resolve(outDir, 'index.js'), 'export function apply() {}\n')
writeFileSync(resolve(outDir, 'package.json'), `${JSON.stringify({
  name: id,
  type: 'module',
  exports: {
    '.': './index.js',
    './client': './client.js',
    './package.json': './package.json',
  },
  dsh: {
    client: {
      inject: [
        '@deepseek-ai/dsh-client-runtime',
        '@isomoes/dsh-web-ui/client/ui-conversation',
        '@isomoes/dsh-web-ui/client/ui-sidebar',
      ],
      platform: 'web',
    },
  },
}, null, 2)}\n`)

export default defineConfig(isolatedClientConfig(
  id,
  resolve(import.meta.dirname, 'client/ui-brand-ikanban/client/index.ts'),
  outDir,
))
