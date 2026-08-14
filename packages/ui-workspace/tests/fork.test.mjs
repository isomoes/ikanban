import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('ships the local workspace client module', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.match(client, /id: "@isomoes\/dsh-ikanban-ui-workspace"/)
  assert.doesNotMatch(client, /id: "@deepseek-ai\/dsh-client-ui-workspace"/)
  assert.match(client, /name: "sidebar\.workspaces"/)
})

test('opens session actions from the row context menu', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.match(client, /onContextMenu: row\.blank \? void 0 : \(e\) => \{\s*e\.preventDefault\(\);\s*setMenuOpen\(true\);\s*\}/)
})

test('opens session actions when Surfingkeys activates a row hint', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.match(client, /onClick: \(e\) => \{\s*if \(e\.detail === 0 && !row\.blank\) \{\s*setMenuOpen\(true\);\s*return;\s*\}\s*onOpen\(node\.id\);\s*\}/)
})

test('supports keyboard-first host path entry when adding a workspace', async () => {
  const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

  assert.match(client, /placeholder: t\("path\.placeholder"\)/)
  assert.match(client, /autoFocus: true/)
  assert.match(client, /const flowBusy = pathOpen \|\| flowOpen \|\| pickingFolder \|\| pathSubmitting/)
  assert.match(client, /if \(e\.key === "Enter"\) \{\s*e\.preventDefault\(\);\s*submitPath\(\);/)
  assert.match(client, /children: t\("path\.browse"\)/)
})
