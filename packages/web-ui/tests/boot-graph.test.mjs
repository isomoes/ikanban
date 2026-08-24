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
        id: '@isomoes/dsh-web-ui/client/ui-theme',
        inject: [
          '@isomoes/dsh-web-ui/client/locale',
          '@isomoes/dsh-web-ui/client/ui-primitives',
        ],
      },
      { id: '@isomoes/dsh-web-ui/client/locale', inject: [] },
    ],
  }

  remapForkedClientInjects(graph)

  assert.deepEqual(graph.entries[0].inject, [
    '@deepseek-ai/dsh-client-runtime',
    '@isomoes/dsh-web-ui/client/ui-theme',
  ])
  assert.deepEqual(graph.entries[1].inject, [
    '@isomoes/dsh-web-ui/client/locale',
    '@isomoes/dsh-web-ui/client/ui-primitives',
  ])
})
