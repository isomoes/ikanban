import assert from 'node:assert/strict'
import { test } from 'node:test'

function snapshot(nodes, turns) {
  const byKey = new Map(nodes.map(node => [node.key, node]))
  return {
    chat: {
      order: nodes.map(node => node.key),
      nodes: { get: key => byKey.get(key) },
      timeline: {
        turnOrder: turns.map(turn => turn.turn),
        turns: new Map(turns.map(turn => [turn.turn, turn])),
      },
    },
  }
}

function user(key, turn, seq, text, extras = {}) {
  return {
    key,
    kind: 'user',
    anchorSeq: seq,
    visibility: 'visible',
    location: { kind: 'turn', turn: { turn } },
    data: { time: seq * 10, content: [{ type: 'text', text }] },
    ...extras,
  }
}

test('derives newest-first restart choices at the previous completed turn', async () => {
  const { timelineChoices } = await import('../lib/clients/ui-timeline/index.js')
  const value = snapshot([
    user('u1', 1, 1, 'first'),
    user('u2', 2, 11, 'second prompt'),
    user('u3', 3, 21, 'third prompt'),
  ], [
    { turn: 1, end: { seq: 9 } },
    { turn: 2, end: { seq: 19 } },
    { turn: 3 },
  ])

  assert.deepEqual(timelineChoices(value), [
    { id: 'user:21', turn: 3, time: 210, text: 'third prompt', forkAtSeq: 19 },
    { id: 'user:11', turn: 2, time: 110, text: 'second prompt', forkAtSeq: 9 },
  ])
})

test('omits first-turn, hidden, non-user, and image-bearing messages', async () => {
  const { timelineChoices } = await import('../lib/clients/ui-timeline/index.js')
  const value = snapshot([
    user('first', 1, 1, 'cannot fork empty history'),
    user('hidden', 2, 11, 'hidden', { visibility: 'hidden' }),
    user('image', 2, 12, 'caption', {
      data: { time: 120, content: [{ type: 'image', id: 'image-1' }, { type: 'text', text: 'caption' }] },
    }),
    { ...user('assistant', 2, 13, 'not a user'), kind: 'assistant-step' },
  ], [
    { turn: 1, end: { seq: 9 } },
    { turn: 2, end: { seq: 19 } },
  ])

  assert.deepEqual(timelineChoices(value), [])
})

test('compacts timeline option labels', async () => {
  const { timelineLabel } = await import('../lib/clients/ui-timeline/index.js')
  assert.equal(timelineLabel(' one\n\n two   three '), 'one two three')
  assert.equal(timelineLabel('123456789', 6), '12345…')
})

test('activates the child before quiescing and archiving the source', async () => {
  const { restartTimelineChoice } = await import('../lib/clients/ui-timeline/index.js')
  const calls = []
  const choice = { id: 'user:11', turn: 2, time: 110, text: 'edit me', forkAtSeq: 9 }
  const child = await restartTimelineChoice('source', choice, {
    fork: async (sourceId, atSeq) => {
      calls.push(['fork', sourceId, atSeq])
      return 'child'
    },
    activateChild: async (childId, text) => { calls.push(['activate', childId, text]) },
    quiesceSource: async () => { calls.push(['quiesce']) },
    archiveSource: async (sourceId) => { calls.push(['archive', sourceId]) },
    recoverSource: () => { calls.push(['recover']) },
  })

  assert.equal(child, 'child')
  assert.deepEqual(calls, [
    ['fork', 'source', 9],
    ['activate', 'child', 'edit me'],
    ['quiesce'],
    ['archive', 'source'],
  ])
})

test('does not archive on activation failure and recovers after quiescence failure', async () => {
  const { restartTimelineChoice } = await import('../lib/clients/ui-timeline/index.js')
  const choice = { id: 'user:11', turn: 2, time: 110, text: 'edit me', forkAtSeq: 9 }
  let archived = false
  let recovered = false
  await assert.rejects(restartTimelineChoice('source', choice, {
    fork: async () => 'child',
    activateChild: async () => { throw new Error('draft unavailable') },
    quiesceSource: async () => {},
    archiveSource: async () => { archived = true },
    recoverSource: () => { recovered = true },
  }), /draft unavailable/)
  assert.equal(archived, false)
  assert.equal(recovered, false)

  await assert.rejects(restartTimelineChoice('source', choice, {
    fork: async () => 'child',
    activateChild: async () => {},
    quiesceSource: async () => { throw new Error('busy') },
    archiveSource: async () => { archived = true },
    recoverSource: () => { recovered = true },
  }), /busy/)
  assert.equal(archived, false)
  assert.equal(recovered, true)
})
