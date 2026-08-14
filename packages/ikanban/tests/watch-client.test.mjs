import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { watchFiles } from '../scripts/watch-client.mjs'

test('rebuilds after a watched UI source changes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ikanban-watch-'))
  const source = join(directory, 'client.js')
  await writeFile(source, 'first')

  let rebuilds = 0
  let resolveRebuild
  const rebuilt = new Promise((resolve) => {
    resolveRebuild = resolve
  })
  const watcher = watchFiles([source], async () => {
    rebuilds += 1
    resolveRebuild()
  }, { debounceMs: 10 })
  let timeout

  try {
    await writeFile(source, 'second')
    await Promise.race([
      rebuilt,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('watcher did not rebuild')), 2000)
      }),
    ])
    assert.equal(rebuilds, 1)
  } finally {
    clearTimeout(timeout)
    watcher.close()
    await rm(directory, { recursive: true, force: true })
  }
})
