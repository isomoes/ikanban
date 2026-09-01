import { access, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const STOCK_PREFIX = '@deepseek-ai/dsh-client-'
const VIRTUAL_PREFIX = '@isomoes/dsh-web-ui/client/'
const local = id => `${VIRTUAL_PREFIX}${id}`

// Package-owned Loader graph. Local UI edges always point at neutral shared
// packages; only shared DSH infrastructure retains its published package id.
const CLIENT_INJECTS = {
  'locale': ['@deepseek-ai/dsh-client-connection', local('ui-renderer'), local('ui-settings'), '@deepseek-ai/dsh-api-remotes'],
  'modules': [],
  'ui-agent-preset': ['@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-client-connection', local('locale'), local('ui-conversation'), local('ui-session'), local('ui-settings'), local('ui-workspace'), local('ui-commands'), '@deepseek-ai/dsh-api-remotes'],
  'ui-approval': ['@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-conversation'), local('ui-renderer'), local('ui-session')],
  'ui-attachment': [local('ui-chat'), local('ui-conversation'), local('ui-renderer'), local('ui-trajectory')],
  'ui-chat': ['@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-api-workspace-controller', local('locale'), local('ui-conversation'), local('ui-layout'), local('ui-renderer'), local('ui-session'), local('ui-settings'), local('ui-workspace')],
  'ui-commands': ['@deepseek-ai/dsh-api-remotes', local('locale'), local('ui-input-trigger'), local('ui-conversation'), local('ui-layout'), local('ui-settings')],
  'ui-conversation': ['@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-layout'), local('ui-renderer'), local('ui-session'), local('ui-settings'), local('ui-workspace'), local('ui-commands')],
  'ui-cordis': ['@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-cordis-client-runner', '@deepseek-ai/dsh-api-remotes', local('locale'), local('ui-input-trigger'), local('ui-renderer'), local('ui-session'), local('ui-tool'), local('ui-sidebar')],
  'ui-deliverables': ['@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-client-connection', local('locale'), local('ui-chat'), local('ui-conversation'), local('ui-renderer')],
  'ui-directory-picker-browse': ['@deepseek-ai/dsh-api-remotes', local('ui-renderer'), local('ui-workspace'), local('locale')],
  'ui-directory-picker-native': [local('ui-renderer'), local('ui-workspace')],
  'ui-goal': ['@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-chat'), local('ui-conversation'), local('ui-renderer'), local('ui-session')],
  'ui-input-trigger': ['@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-conversation'), local('ui-renderer')],
  'ui-jobs': [local('locale'), local('ui-conversation'), local('ui-primitives')],
  'ui-layout': [local('locale'), local('ui-renderer'), local('ui-session'), local('ui-theme')],
  'ui-message-feedback': ['@deepseek-ai/dsh-api-remotes', local('locale'), local('ui-conversation'), local('ui-renderer')],
  'ui-model-selection': ['@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-api-workspace-controller', local('locale'), local('ui-commands'), local('ui-settings'), local('ui-workspace'), '@deepseek-ai/dsh-api-remotes'],
  'ui-permission-presets': ['@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-commands'), '@deepseek-ai/dsh-api-remotes', local('ui-settings')],
  'ui-plan': ['@deepseek-ai/dsh-api-remotes', local('locale'), local('ui-conversation')],
  'ui-reference': ['@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-client-connection', local('locale'), local('ui-input-trigger')],
  'ui-reminders': ['@deepseek-ai/dsh-api-session-controller', local('ui-session'), local('ui-settings'), local('locale')],
  'ui-renderer': [],
  'ui-schedule': [local('locale'), local('ui-conversation'), local('ui-primitives')],
  'ui-session': ['@deepseek-ai/dsh-api-session-controller', local('ui-renderer')],
  'ui-settings': ['@deepseek-ai/dsh-api-remotes'],
  'ui-settings-general': [local('ui-settings'), local('locale'), '@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-api-remotes', local('ui-sidebar'), local('ui-commands')],
  'ui-settings-models': [local('ui-settings'), local('locale'), '@deepseek-ai/dsh-api-remotes'],
  'ui-settings-plugin-inventory': ['@deepseek-ai/dsh-api-remotes', local('ui-settings'), local('locale'), local('ui-agent-preset')],
  'ui-settings-plugins': [local('locale'), local('ui-settings'), '@deepseek-ai/dsh-api-remotes'],
  'ui-sidebar': ['@deepseek-ai/dsh-api-workspace-controller', local('ui-renderer'), local('ui-layout'), local('ui-session'), local('ui-workspace'), local('ui-commands'), local('locale')],
  'ui-skill': ['@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-renderer'), local('ui-tool'), local('ui-input-trigger'), '@deepseek-ai/dsh-api-remotes'],
  'ui-subagent': ['@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-conversation'), local('ui-primitives'), local('ui-input-trigger')],
  'ui-theme': ['@deepseek-ai/dsh-client-connection', local('locale'), local('ui-renderer'), local('ui-settings'), '@deepseek-ai/dsh-api-remotes'],
  'ui-timeline': ['@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-api-workspace-controller', local('ui-session'), local('locale'), local('ui-commands'), local('ui-chat'), local('ui-conversation'), local('ui-workspace')],
  'ui-tool': ['@deepseek-ai/dsh-api-workspace-controller', '@deepseek-ai/dsh-client-connection', local('locale'), local('ui-conversation')],
  'ui-trajectory': ['@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-conversation'), local('ui-renderer'), local('ui-session')],
  'ui-user-questions': ['@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-conversation'), local('ui-renderer'), local('ui-session')],
  'ui-workflow-run': ['@deepseek-ai/dsh-api-session-controller', local('locale'), local('ui-chat'), local('ui-conversation'), local('ui-renderer'), local('ui-session')],
  'ui-workspace': ['@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-api-session-controller', '@deepseek-ai/dsh-api-workspace-controller', '@deepseek-ai/dsh-client-connection', local('locale'), local('ui-commands'), local('ui-conversation'), local('ui-renderer'), local('ui-session'), local('ui-sidebar')],
}

const IMMEDIATE_CLIENTS = new Set(['locale', 'modules', 'ui-renderer', 'ui-theme'])

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
    ...await sourceEntries(sourceRoot, 'client'),
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
