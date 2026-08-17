import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, inject, parseProjectMcpConfig, scopedServerName } from '../lib/index.js'

const root = process.platform === 'win32' ? 'C:\\work\\paper' : '/work/paper'

test('parses stdio and Streamable HTTP project servers', () => {
  const servers = parseProjectMcpConfig(JSON.stringify({
    mcpServers: {
      paper: {
        command: 'npx',
        args: ['-y', '@ai4paper/apaper-mcp'],
        env: { TOKEN: 'secret' },
        cwd: 'tools',
      },
      remote: {
        type: 'http',
        url: 'https://example.test/mcp',
        headers: { Authorization: 'Bearer token' },
      },
      disabled: {
        command: 'ignored',
        disabled: true,
      },
    },
  }), root)

  assert.deepEqual(servers, [
    {
      name: 'paper',
      config: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@ai4paper/apaper-mcp'],
        env: { TOKEN: 'secret' },
        cwd: process.platform === 'win32' ? 'C:\\work\\paper\\tools' : '/work/paper/tools',
      },
    },
    {
      name: 'remote',
      config: {
        transport: 'streamable-http',
        url: 'https://example.test/mcp',
        headers: { Authorization: 'Bearer token' },
      },
    },
  ])
})

test('rejects malformed and unsupported server definitions', () => {
  assert.throws(
    () => parseProjectMcpConfig('{', root),
    /is not valid JSON/,
  )
  assert.throws(
    () => parseProjectMcpConfig('{"mcpServers":{"bad":{"command":"x","url":"https://example.test"}}}', root),
    /exactly one of "command" or "url"/,
  )
  assert.throws(
    () => parseProjectMcpConfig('{"mcpServers":{"legacy":{"type":"sse","url":"https://example.test"}}}', root),
    /unsupported type "sse"/,
  )
})

test('reassembles once after first-agent MCP loading so turn one sees new tools', async () => {
  let listener
  let prepend
  const fresh = { tools: [{ name: 'mcp_tool' }] }
  const ctx = {
    systemPrompt: {
      async assemble() {
        return fresh
      },
    },
    on(event, callback, options) {
      assert.equal(event, 'system-prompt/assemble')
      listener = callback
      prepend = options
    },
  }
  apply(ctx, { failOnStartupError: false })

  assert.deepEqual(inject, ['systemPrompt', 'tools'])
  assert.equal(prepend, true)
  const agent = { session: { header: {} } }
  let nextCalls = 0
  const next = async () => {
    nextCalls += 1
    return { tools: [] }
  }

  assert.equal(await listener({ tools: [] }, { agent }, next), fresh)
  assert.equal(nextCalls, 0)
  assert.deepEqual(await listener(fresh, { agent }, next), { tools: [] })
  assert.equal(nextCalls, 1)
})

test('creates valid stable per-agent MCP namespaces', () => {
  const first = scopedServerName('server name with spaces and a very long suffix', 'session-a')
  const again = scopedServerName('server name with spaces and a very long suffix', 'session-a')
  const other = scopedServerName('server name with spaces and a very long suffix', 'session-b')
  const lossyCollision = scopedServerName('server?name with spaces and a very long suffix', 'session-a')

  assert.equal(first, again)
  assert.notEqual(first, other)
  assert.notEqual(first, lossyCollision)
  assert.ok(first.length <= 32)
  assert.match(first, /^[A-Za-z0-9_-]+$/)
})
