import { access, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const STOCK_PREFIX = '@deepseek-ai/dsh-client-'
const VIRTUAL_PREFIX = '@isomoes/dsh-ikanban/client/'
const local = id => `${VIRTUAL_PREFIX}${id}`

// Package-owned Loader graph. Local UI edges always point at iKanban virtual
// packages; only shared DSH infrastructure retains its published package id.
const CLIENT_INJECTS = {
  'locale': ['@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-client-runtime', local('ui-settings'), '@deepseek-ai/dsh-api-remotes'],
  'ui-agent-preset': ['@deepseek-ai/dsh-client-connection', local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-conversation'), local('ui-settings'), '@deepseek-ai/dsh-api-remotes'],
  'ui-attachment': [local('ui-conversation')],
  'ui-brand-official': ['@deepseek-ai/dsh-client-runtime', local('ui-conversation'), local('ui-sidebar')],
  'ui-commands': ['@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-client-runtime', local('locale'), local('ui-input-trigger'), local('ui-conversation'), local('ui-layout')],
  'ui-conversation': ['@deepseek-ai/dsh-client-connection', local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-settings'), '@deepseek-ai/dsh-api-remotes', local('ui-layout')],
  'ui-cordis': ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-cordis-client-runner', '@deepseek-ai/dsh-api-remotes', local('locale'), local('ui-input-trigger'), local('ui-tool'), local('ui-sidebar')],
  'ui-deliverables': ['@deepseek-ai/dsh-client-connection', local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-conversation')],
  'ui-directory-picker-browse': ['@deepseek-ai/dsh-client-runtime', local('ui-workspace'), local('locale')],
  'ui-directory-picker-native': ['@deepseek-ai/dsh-client-runtime', local('ui-workspace')],
  'ui-goal': ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-api-remotes', local('locale'), local('ui-conversation')],
  'ui-input-trigger': ['@deepseek-ai/dsh-client-runtime', local('locale')],
  'ui-jobs': [local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-conversation'), local('ui-primitives')],
  'ui-layout': ['@deepseek-ai/dsh-client-runtime', local('ui-theme')],
  'ui-message-feedback': ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-api-remotes', local('locale'), local('ui-conversation')],
  'ui-model-selection': [local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-commands'), '@deepseek-ai/dsh-api-remotes'],
  'ui-permission-presets': ['@deepseek-ai/dsh-client-connection', local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-commands'), '@deepseek-ai/dsh-api-remotes', local('ui-settings')],
  'ui-plan': ['@deepseek-ai/dsh-api-remotes', local('locale'), local('ui-conversation')],
  'ui-reference': ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-api-remotes', local('locale'), local('ui-input-trigger')],
  'ui-renderer': ['@deepseek-ai/dsh-client-runtime'],
  'ui-settings': ['@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-api-remotes'],
  'ui-settings-general': ['@deepseek-ai/dsh-client-runtime', local('ui-settings'), local('locale'), '@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-api-remotes', local('ui-sidebar'), local('ui-commands')],
  'ui-settings-models': ['@deepseek-ai/dsh-client-runtime', local('ui-settings'), local('locale'), '@deepseek-ai/dsh-api-remotes'],
  'ui-settings-plugin-inventory': ['@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-client-runtime', local('ui-settings'), local('locale')],
  'ui-settings-plugins': ['@deepseek-ai/dsh-client-connection', local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-settings'), '@deepseek-ai/dsh-api-remotes'],
  'ui-sidebar': ['@deepseek-ai/dsh-client-runtime', local('ui-layout'), local('locale'), local('ui-commands')],
  'ui-skill': ['@deepseek-ai/dsh-client-runtime', local('locale'), local('ui-tool'), local('ui-input-trigger'), '@deepseek-ai/dsh-api-remotes'],
  'ui-subagent': [local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-conversation'), local('ui-primitives'), local('ui-input-trigger')],
  'ui-theme': ['@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-client-runtime', local('locale'), local('ui-settings'), '@deepseek-ai/dsh-api-remotes'],
  'ui-timeline': ['@deepseek-ai/dsh-client-runtime', local('locale'), local('ui-commands'), local('ui-conversation'), local('ui-workspace')],
  'ui-tool': ['@deepseek-ai/dsh-client-runtime', local('locale'), local('ui-conversation')],
  'ui-trajectory': [local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-conversation')],
  'ui-user-questions': [local('locale'), local('ui-conversation')],
  'ui-workflow-run': [local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-conversation')],
  'ui-workspace': ['@deepseek-ai/dsh-client-connection', local('locale'), '@deepseek-ai/dsh-client-runtime', local('ui-conversation'), local('ui-input-trigger'), local('ui-sidebar')],
}

const IMMEDIATE_CLIENTS = new Set(['locale', 'ui-renderer', 'ui-theme'])

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function sourceEntries(sourceRoot, parent, excluded = new Set()) {
  const root = resolve(sourceRoot, parent)
  const directories = await readdir(root, { withFileTypes: true })
  const entries = []
  for (const directory of directories) {
    if (!directory.isDirectory() || excluded.has(directory.name)) continue
    const source = resolve(root, directory.name, 'client/index.ts')
    if (!await exists(source)) continue
    entries.push({ id: directory.name, source })
  }
  return entries
}

/** Discover the complete locally owned client surface and Loader graph. */
export async function discoverClientEntries({ packageRoot }) {
  const sourceRoot = resolve(packageRoot, 'src')
  const discovered = [
    ...await sourceEntries(sourceRoot, 'client', new Set(['modules'])),
    ...await sourceEntries(sourceRoot, 'extensions'),
  ].sort((left, right) => left.id.localeCompare(right.id))
  const entries = []

  for (const item of discovered) {
    const inject = CLIENT_INJECTS[item.id]
    if (inject === undefined) throw new Error(`Missing local client metadata for ${item.id}`)

    const hostCandidate = resolve(sourceRoot, 'client', item.id, 'index.ts')
    let host
    if (await exists(hostCandidate)) {
      const hostSource = await readFile(hostCandidate, 'utf8')
      if (/^import\s|\sfrom\s+['"]/m.test(hostSource)) host = hostCandidate
    }

    entries.push({
      id: item.id,
      stockId: `${STOCK_PREFIX}${item.id}`,
      virtualId: local(item.id),
      source: item.source,
      ...(host === undefined ? {} : { host }),
      client: {
        inject,
        platform: 'web',
        ...(IMMEDIATE_CLIENTS.has(item.id) ? { immediately: true } : {}),
      },
    })
  }

  if (entries.length !== Object.keys(CLIENT_INJECTS).length) {
    throw new Error(`Discovered ${entries.length} clients but metadata declares ${Object.keys(CLIENT_INJECTS).length}`)
  }
  return entries
}
