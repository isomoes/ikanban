import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { discoverPresets } from '@deepseek-ai/dsh-agent-presets'
import {
  IKANBAN_PRESET_ROOT,
  registerIkanbanPresetRoot,
} from '../lib/ikanban-preset.js'

test('registers the package preset as the first system root', () => {
  const userRoot = { path: '/tmp/user-presets', trust: 'user' }
  const registry = { roots: [userRoot] }

  assert.equal(registerIkanbanPresetRoot(registry), 'registered')
  assert.deepEqual(registry.roots, [
    { path: IKANBAN_PRESET_ROOT, trust: 'system' },
    userRoot,
  ])
  assert.equal(join(IKANBAN_PRESET_ROOT, 'ikanban', 'agent.cordis.yml').endsWith('preset/ikanban/agent.cordis.yml'), true)
})

test('does not register the package root twice', () => {
  const root = { path: IKANBAN_PRESET_ROOT, trust: 'system' }
  const registry = { roots: [root] }

  assert.equal(registerIkanbanPresetRoot(registry), 'existing')
  assert.deepEqual(registry.roots, [root])
})

test('discovers iKanban as a healthy built-in preset', async () => {
  const presets = await discoverPresets([{ path: IKANBAN_PRESET_ROOT, trust: 'system' }])
  const ikanban = presets.find(preset => preset.id === 'ikanban')

  assert.ok(ikanban)
  assert.equal(ikanban.name, 'iKanban')
  assert.equal(ikanban.trust, 'system')
  assert.equal(ikanban.broken, undefined)
})
