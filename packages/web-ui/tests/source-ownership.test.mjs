import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('pins the source fork and declares its client entries', async () => {
  const provenance = await readFile(new URL('../UPSTREAM.md', import.meta.url), 'utf8')
  assert.match(provenance, /47f943859b/)
  const entries = JSON.parse(await readFile(new URL('../src/entries.json', import.meta.url), 'utf8'))
  assert.equal(entries['@deepseek-ai/dsh-client-ui-layout'], 'packages/client/ui-layout/src/client/index.ts')
  assert.equal(entries['@deepseek-ai/dsh-client-ui-sidebar'], 'packages/client/ui-sidebar/src/client/index.ts')
  assert.equal(entries['@deepseek-ai/dsh-client-ui-workspace'], 'packages/client/ui-workspace/src/client/index.ts')
})
