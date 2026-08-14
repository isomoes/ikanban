import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('bundles all private UI forks behind the main client module', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.match(client, /id: "@isomoes\/dsh-ikanban"/)
  assert.doesNotMatch(client, /id: "@isomoes\/dsh-ikanban-ui-/)
  assert.match(client, /tag\.dataset\.plugin = "@isomoes\/dsh-ikanban"/)
  assert.match(client, /children: "Ikanban"/)
  assert.match(client, /new EventSource\("\/plugins\/events"\)/)
  assert.match(client, /window\.location\.reload\(\)/)
})
