import assert from 'node:assert/strict'
import test from 'node:test'

let remapForkedClientInjects
try {
  ({ remapForkedClientInjects } = await import('../src/client-id-aliases.ts'))
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
}

test('remaps stock inject edges only when the local client is present', () => {
  assert.equal(typeof remapForkedClientInjects, 'function')

  const graph = {
    rev: 'test',
    entries: [
      {
        id: '@deepseek-ai/dsh-cordis-client-runner',
        inject: [
          '@deepseek-ai/dsh-client-runtime',
          '@deepseek-ai/dsh-client-ui-theme',
        ],
      },
      {
        id: '@isomoes/dsh-ikanban/client/ui-theme',
        inject: [
          '@deepseek-ai/dsh-client-locale',
          '@deepseek-ai/dsh-client-ui-primitives',
        ],
      },
      { id: '@isomoes/dsh-ikanban/client/locale', inject: [] },
    ],
  }

  remapForkedClientInjects(graph)

  assert.deepEqual(graph.entries[0].inject, [
    '@deepseek-ai/dsh-client-runtime',
    '@isomoes/dsh-ikanban/client/ui-theme',
  ])
  assert.deepEqual(graph.entries[1].inject, [
    '@isomoes/dsh-ikanban/client/locale',
    '@deepseek-ai/dsh-client-ui-primitives',
  ])
})
