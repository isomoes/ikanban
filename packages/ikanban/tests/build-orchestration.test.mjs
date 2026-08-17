import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const readManifest = async (url) => JSON.parse(await readFile(url, 'utf8'))

test('build lifecycles produce private Web UI artifacts without recursive orchestration', async () => {
  const [root, ikanban, webUi, projectMcp, composition, projectMcpPresetFragment] = await Promise.all([
    readManifest(new URL('../../../package.json', import.meta.url)),
    readManifest(new URL('../package.json', import.meta.url)),
    readManifest(new URL('../../web-ui/package.json', import.meta.url)),
    readManifest(new URL('../../project-mcp/package.json', import.meta.url)),
    readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'),
    readFile(new URL('../project-mcp.preset.yml', import.meta.url), 'utf8'),
  ])

  assert.equal(root.scripts.build, 'pnpm -r --if-present run build:package')
  assert.equal(webUi.scripts.build, 'pnpm build:package')
  assert.ok(webUi.scripts['build:package'])
  assert.equal(
    ikanban.scripts.build,
    'pnpm --filter @isomoes/dsh-project-mcp build:package && pnpm --filter @isomoes/dsh-ikanban-web-ui build:package && pnpm build:package',
  )
  assert.ok(ikanban.scripts['build:package'])
  assert.doesNotMatch(ikanban.scripts['build:package'], /(?:^|\s)pnpm build(?:\s|$)/)
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-web-app'], undefined)
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-host-directory-picker-native'], undefined)
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-agent-loop'], '^0.1.0-rc.6')
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-tools'], '^0.1.0-rc.6')
  assert.equal(ikanban.dependencies['@isomoes/dsh-project-mcp'], undefined)
  assert.equal(ikanban.devDependencies['@isomoes/dsh-project-mcp'], 'workspace:*')
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-mcp-client'], '^0.1.0-rc.6')
  assert.equal(ikanban.peerDependencies['@deepseek-ai/dsh-system-prompt'], '^0.1.0-rc.6')
  assert.equal(projectMcp.private, true)
  assert.equal(projectMcp.dependencies['@deepseek-ai/dsh-mcp-client'], '^0.1.0-rc.6')
  assert.doesNotMatch(composition, /name: '@isomoes\/dsh-project-mcp'/)
  assert.match(composition, /- id: ikanban-preset\n      name: '@isomoes\/dsh-ikanban\/ikanban-preset'/)
  assert.match(projectMcpPresetFragment, /- id: project-mcp\n  name: '@isomoes\/dsh-ikanban\/project-mcp'/)
  assert.equal(ikanban.devDependencies['@deepseek-ai/dsh-web-app'], undefined)
})
