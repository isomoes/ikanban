import assert from 'node:assert/strict'
import { test } from 'node:test'

function session(id, extras = {}) {
  return {
    id,
    displayTitle: id,
    running: false,
    blank: false,
    updatedAt: 0,
    ...extras,
  }
}

function list(ids, byId, current) {
  return {
    ids,
    byId,
    current,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

test('selects the next visible session after the archived current session', async () => {
  const { nextSessionAfterArchive } = await import('../lib/clients/ui-workspace/index.js')
  const state = list(
    ['current', 'blank', 'subagent', 'archived', 'next'],
    {
      current: session('current'),
      blank: session('blank', { blank: true }),
      subagent: session('subagent', { origin: 'subagent' }),
      archived: session('archived'),
      next: session('next'),
    },
    'current',
  )

  assert.equal(nextSessionAfterArchive(state, ['archived'], 'current'), 'next')
})

test('falls back to the preceding visible session when archiving the last row', async () => {
  const { nextSessionAfterArchive } = await import('../lib/clients/ui-workspace/index.js')
  const state = list(
    ['first', 'archived', 'current'],
    {
      first: session('first'),
      archived: session('archived'),
      current: session('current'),
    },
    'current',
  )

  assert.equal(nextSessionAfterArchive(state, ['archived'], 'current'), 'first')
})

test('returns no target when no other visible session exists', async () => {
  const { nextSessionAfterArchive } = await import('../lib/clients/ui-workspace/index.js')
  const state = list(['current'], { current: session('current') }, 'current')

  assert.equal(nextSessionAfterArchive(state, [], 'current'), undefined)
})
