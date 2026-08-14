import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('ships the branded local sidebar client module', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.match(client, /id: "@isomoes\/dsh-ikanban-ui-sidebar"/)
  assert.doesNotMatch(client, /id: "@deepseek-ai\/dsh-client-ui-sidebar"/)
  assert.match(client, /children: "Ikanban"/)
  assert.doesNotMatch(client, /BrandWordmark/)
})
