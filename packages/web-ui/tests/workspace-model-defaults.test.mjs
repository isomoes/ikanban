import assert from 'node:assert/strict'
import { test } from 'node:test'

function settings(value = {}) {
  const writes = []
  const listeners = new Set()
  return {
    writes,
    scope: {
      getSnapshot: () => ({ status: 'ready', value, writable: true, mode: 'host' }),
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      async set(field, next) { writes.push([field, next]) },
      async unset() {},
    },
  }
}

function context({ blank = true, workspace = 'workspace-a' } = {}) {
  return {
    workspaceForSession: () => workspace,
    sessionIsBlank: () => blank,
  }
}

test('blank sessions inherit only their own workspace model route', async () => {
  const { WorkspaceModelDefaults } = await import('../lib/clients/ui-model-selection/index.js')
  const host = settings({
    'workspace-a': { provider: 'anthropic', model: 'claude-sonnet' },
    'workspace-b': { provider: 'openai', model: 'gpt-5' },
  })
  const defaults = new WorkspaceModelDefaults(host.scope, context())

  assert.deepEqual(defaults.preferredFor('session-a'), {
    provider: 'anthropic',
    model: 'claude-sonnet',
  })
})

test('started sessions neither inherit nor replace the workspace default', async () => {
  const { WorkspaceModelDefaults } = await import('../lib/clients/ui-model-selection/index.js')
  const host = settings({ 'workspace-a': { provider: 'openai', model: 'gpt-5' } })
  const defaults = new WorkspaceModelDefaults(host.scope, context({ blank: false }))

  assert.equal(defaults.preferredFor('session-a'), undefined)
  await defaults.remember('session-a', { provider: 'anthropic', model: 'claude-sonnet' })
  assert.deepEqual(host.writes, [])
})

test('a blank-session choice stores provider and model for future sessions', async () => {
  const { WorkspaceModelDefaults } = await import('../lib/clients/ui-model-selection/index.js')
  const host = settings()
  const defaults = new WorkspaceModelDefaults(host.scope, context({ workspace: 'workspace-b' }))

  await defaults.remember('session-b', {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    reasoningEffort: 'high',
  })

  assert.deepEqual(host.writes, [[
    'workspace-b',
    { provider: 'deepseek', model: 'deepseek-reasoner' },
  ]])
})
