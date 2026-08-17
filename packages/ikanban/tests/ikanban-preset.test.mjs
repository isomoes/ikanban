import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  ensureIkanbanPreset,
  IKANBAN_PRESET_ID,
  IKANBAN_PRESET_NAME,
} from '../lib/ikanban-preset.js'

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'ikanban-preset-'))
  const entries = []
  const authoring = {
    async list() {
      return [...entries]
    },
    async copy(from, id, name) {
      assert.equal(from, 'standard')
      assert.equal(id, IKANBAN_PRESET_ID)
      assert.equal(name, IKANBAN_PRESET_NAME)
      const path = join(root, 'agent.cordis.yml')
      await writeFile(path, '- id: tool-skill\n  name: \'@deepseek-ai/dsh-tool-skill\'\n')
      entries.push({ id, name, path, trust: 'user' })
    },
    async remove(id) {
      const index = entries.findIndex(entry => entry.id === id)
      if (index >= 0) entries.splice(index, 1)
    },
  }
  return { root, entries, authoring }
}

test('copies Standard once and appends the project MCP row', async () => {
  const { root, entries, authoring } = await fixture()
  try {
    assert.equal(await ensureIkanbanPreset(authoring), 'installed')
    assert.equal(entries.length, 1)
    assert.match(await readFile(entries[0].path, 'utf8'), /name: '@isomoes\/dsh-ikanban\/project-mcp'/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('never overwrites an existing user preset', async () => {
  const { root, entries, authoring } = await fixture()
  try {
    const path = join(root, 'existing.cordis.yml')
    const original = '# locally edited\n[]\n'
    await writeFile(path, original)
    entries.push({ id: IKANBAN_PRESET_ID, name: 'Custom name', path, trust: 'user' })

    assert.equal(await ensureIkanbanPreset(authoring), 'existing')
    assert.equal(await readFile(path, 'utf8'), original)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
