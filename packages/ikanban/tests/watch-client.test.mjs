import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { watchFiles } from '../scripts/watch-client.mjs'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function waitFor(predicate, message) {
  const deadline = Date.now() + 2000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message)
    await delay(10)
  }
}

test('watches nested TypeScript, TSX, CSS module, and frontend shell sources', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ikanban-watch-'))
  const paths = [
    join(directory, 'packages/client/plugin/src/index.ts'),
    join(directory, 'packages/client/plugin/src/View.tsx'),
    join(directory, 'packages/client/plugin/src/View.module.css'),
    join(directory, 'apps/web/src/main.ts'),
  ]
  for (const path of paths) {
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, 'first')
  }

  const changed = new Set()
  const watcher = watchFiles([directory], async files => {
    for (const file of files) changed.add(file)
  }, { debounceMs: 10 })

  try {
    for (const path of paths) await writeFile(path, 'second')
    await waitFor(() => paths.every(path => changed.has(path)), 'watcher missed an editable source')
  } finally {
    watcher.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('ignores generated lib and dist writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ikanban-watch-'))
  const generated = [join(directory, 'lib/client.js'), join(directory, 'dist/index.js')]
  for (const path of generated) {
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, 'first')
  }
  let rebuilds = 0
  const watcher = watchFiles([directory], async () => { rebuilds += 1 }, { debounceMs: 10 })

  try {
    for (const path of generated) await writeFile(path, 'second')
    await delay(100)
    assert.equal(rebuilds, 0)
  } finally {
    watcher.close()
    await rm(directory, { recursive: true, force: true })
  }
})

test('coalesces concurrent changes into one queued rebuild', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ikanban-watch-'))
  const source = join(directory, 'src/client.ts')
  await mkdir(join(source, '..'), { recursive: true })
  await writeFile(source, 'first')

  let rebuilds = 0
  let releaseFirst
  const firstStarted = new Promise(resolve => { releaseFirst = resolve })
  let unblockFirst
  const firstBlocked = new Promise(resolve => { unblockFirst = resolve })
  const watcher = watchFiles([directory], async () => {
    rebuilds += 1
    if (rebuilds === 1) {
      releaseFirst()
      await firstBlocked
    }
  }, { debounceMs: 10 })

  try {
    await writeFile(source, 'second')
    await firstStarted
    await writeFile(source, 'third')
    await writeFile(source, 'fourth')
    await delay(30)
    unblockFirst()
    await waitFor(() => rebuilds === 2, 'queued rebuild did not run')
    await delay(50)
    assert.equal(rebuilds, 2)
  } finally {
    watcher.close()
    await rm(directory, { recursive: true, force: true })
  }
})
