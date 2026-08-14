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

test('uses the Ikanban favicon for the expanded and collapsed sidebar identity', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.match(client, /function AppIcon\(\{ size \}\)/)
  assert.match(client, /fill: "#131010"/)
  assert.match(client, /x: 328,\s+y: 344,\s+width: 88,\s+height: 48/)
  assert.equal(client.match(/react_jsx_runtime\.jsx\)\(AppIcon/g)?.length, 2)
  assert.doesNotMatch(client, /FishLogo/)
})
