import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('publishes the local Vite frontend and every referenced root asset', async () => {
  const webRoot = new URL('../lib/web/', import.meta.url)
  const html = await readFile(new URL('index.html', webRoot), 'utf8')
  const references = [...html.matchAll(/(?:src|href)="\/([^"]+)"/g)].map((match) => match[1])

  assert.match(html, /<div id="root"><\/div>/)
  assert.ok(references.length > 0)
  await Promise.all(references.map((reference) => access(new URL(reference, webRoot))))
})
