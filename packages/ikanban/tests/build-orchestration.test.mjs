import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const readManifest = async (url) => JSON.parse(await readFile(url, 'utf8'))

test('build lifecycles consume the publishable shared Web UI without recursive orchestration', async () => {
  const [root, ikanban, webUi, projectMcp, composition, projectMcpPresetFragment, shippedPreset] = await Promise.all([
    readManifest(new URL('../../../package.json', import.meta.url)),
    readManifest(new URL('../package.json', import.meta.url)),
    readManifest(new URL('../../web-ui/package.json', import.meta.url)),
    readManifest(new URL('../../project-mcp/package.json', import.meta.url)),
    readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'),
    readFile(new URL('../project-mcp.preset.yml', import.meta.url), 'utf8'),
    readFile(new URL('../preset/ikanban/agent.cordis.yml', import.meta.url), 'utf8'),
  ])

  assert.equal(root.scripts.build, 'pnpm -r --if-present run build:package')
  assert.equal(
    root.scripts['dev:install'],
    'IKANBAN_DEV=1 pnpm build && IKANBAN_DEV=1 dsh plugin --profile ikanban-dev add ./packages/ikanban',
    'the profile install must preserve the dev marker when pnpm runs the linked package prepare script',
  )
  assert.equal(root.devDependencies['@deepseek-ai/dsh'], '^0.1.1-rc.1')
  for (const peerAnchor of [
    '@deepseek-ai/dsh-anonymous-user-id',
    '@deepseek-ai/dsh-bash-local',
    '@deepseek-ai/dsh-fs',
    '@deepseek-ai/dsh-output-retention',
    '@deepseek-ai/dsh-session-telemetry',
    '@deepseek-ai/dsh-session-title-llm',
    '@deepseek-ai/dsh-spill',
    '@deepseek-ai/dsh-subagent-in-process-driver',
  ]) {
    assert.equal(root.devDependencies[peerAnchor], '^0.1.1-rc.1')
  }
  assert.equal(webUi.name, '@isomoes/dsh-web-ui')
  assert.equal(webUi.private, false)
  assert.ok(webUi.keywords.includes('web-ui'))
  assert.ok(webUi.files.includes('README.md'))
  assert.ok(webUi.files.includes('!lib/**/*.js.map'))
  assert.ok(webUi.files.includes('!web/**/*.js.map'))
  assert.equal(webUi.scripts.build, 'pnpm build:package')
  assert.equal(webUi.scripts.prepack, 'pnpm build:package')
  assert.ok(webUi.scripts['build:package'])
  assert.equal(
    ikanban.scripts.build,
    'pnpm --filter @isomoes/dsh-project-mcp build:package && pnpm --filter @isomoes/dsh-web-ui build:package && pnpm build:package',
  )
  assert.ok(ikanban.scripts['build:package'])
  assert.doesNotMatch(ikanban.scripts['build:package'], /(?:^|\s)pnpm build(?:\s|$)/)
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-web-app'], undefined)
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-host-directory-picker-native'], undefined)
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-agent-loop'], '^0.1.1-rc.1')
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-tools'], '^0.1.1-rc.1')
  assert.equal(ikanban.dependencies['@isomoes/dsh-web-ui'], 'workspace:0.4.18')
  assert.equal(ikanban.dependencies['@isomoes/dsh-project-mcp'], undefined)
  assert.equal(ikanban.devDependencies['@isomoes/dsh-project-mcp'], 'workspace:*')
  assert.equal(ikanban.dependencies['@deepseek-ai/dsh-mcp-client'], '^0.1.1-rc.1')
  assert.equal(ikanban.peerDependencies['@deepseek-ai/dsh-system-prompt'], '^0.1.1-rc.1')
  assert.equal(projectMcp.private, true)
  assert.equal(projectMcp.dependencies['@deepseek-ai/dsh-mcp-client'], '^0.1.1-rc.1')
  assert.doesNotMatch(composition, /name: '@isomoes\/dsh-project-mcp'/)
  assert.match(composition, /- id: ikanban-preset\n      name: '@isomoes\/dsh-ikanban\/ikanban-preset'/)
  assert.match(projectMcpPresetFragment, /- id: project-mcp\n  name: '@isomoes\/dsh-ikanban\/project-mcp'/)
  assert.match(shippedPreset, /- id: project-mcp\n  name: '@isomoes\/dsh-ikanban\/project-mcp'/)
  assert.ok(ikanban.files.includes('preset/ikanban/**'))
  assert.equal(ikanban.devDependencies['@deepseek-ai/dsh-web-app'], undefined)
})
