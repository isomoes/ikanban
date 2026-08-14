import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('ships the local workspace client module', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.match(client, /id: "@isomoes\/dsh-ikanban-ui-workspace"/)
  assert.doesNotMatch(client, /id: "@deepseek-ai\/dsh-client-ui-workspace"/)
  assert.match(client, /name: "sidebar\.workspaces"/)
})
