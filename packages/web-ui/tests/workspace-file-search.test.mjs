import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

const exec = promisify(execFile)

test('uses a valid connection RPC channel', async () => {
  const { WORKSPACE_FILE_CHANNEL } = await import('../lib/clients/ui-workspace/index.js')
  assert.match(WORKSPACE_FILE_CHANNEL, /^\/[A-Za-z0-9._~-]+$/)
  assert.notEqual(WORKSPACE_FILE_CHANNEL, '/api')
})

test('keeps the search endpoint compatible with a live host', async () => {
  const plugin = await import('../lib/clients/ui-workspace/index.js')
  let handler
  const root = await mkdtemp(join(tmpdir(), 'ikanban-file-search-'))
  try {
    await writeFile(join(root, 'README.md'), '')
    plugin.apply({
      get: () => ({ list: () => [{ path: root }] }),
      connection: {
        rpc: {
          handle(_channel, registered) {
            handler = registered
            return async () => {}
          },
        },
      },
      effect(register) {
        register()
      },
    })

    const result = await handler('search', { cwd: root, query: '' }, new AbortController().signal)
    assert.equal(result.ok, true)
    assert.deepEqual(result.value, ['README.md'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('searches workspace files using relative paths and gitignore rules', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ikanban-file-search-'))
  try {
    await exec('git', ['init', '--quiet'], { cwd: root })
    await mkdir(join(root, 'src'), { recursive: true })
    await mkdir(join(root, 'generated'), { recursive: true })
    await writeFile(join(root, '.gitignore'), 'generated/\n')
    await writeFile(join(root, 'README.md'), '')
    await writeFile(join(root, 'src', 'message-input.tsx'), '')
    await writeFile(join(root, 'generated', 'message-input.js'), '')

    const { listWorkspaceFiles, searchWorkspaceFiles } = await import('../lib/clients/ui-workspace/index.js')
    const catalog = await listWorkspaceFiles(root, new AbortController().signal)
    const results = await searchWorkspaceFiles(root, 'message', new AbortController().signal)

    assert.deepEqual(catalog, ['.gitignore', 'README.md', 'src/message-input.tsx'])
    assert.deepEqual(results, ['src/message-input.tsx'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('fuzzy matches non-contiguous characters in workspace paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ikanban-file-search-'))
  try {
    await exec('git', ['init', '--quiet'], { cwd: root })
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src', 'message-input.tsx'), '')
    await writeFile(join(root, 'src', 'migration.ts'), '')

    const { searchWorkspaceFiles } = await import('../lib/clients/ui-workspace/index.js')
    const results = await searchWorkspaceFiles(root, 'msgin', new AbortController().signal)

    assert.deepEqual(results, ['src/message-input.tsx'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('searches files in a workspace without a git repository', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ikanban-file-search-'))
  try {
    await mkdir(join(root, 'src'), { recursive: true })
    await mkdir(join(root, 'node_modules', 'dependency'), { recursive: true })
    await writeFile(join(root, 'src', 'composer.tsx'), '')
    await writeFile(join(root, 'node_modules', 'dependency', 'composer.js'), '')

    const { searchWorkspaceFiles } = await import('../lib/clients/ui-workspace/index.js')
    const results = await searchWorkspaceFiles(root, 'composer', new AbortController().signal)

    assert.deepEqual(results, ['src/composer.tsx'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
