import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as McpClient from '@deepseek-ai/dsh-mcp-client'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'

export const name = 'project-mcp'
export const inject = ['systemPrompt', 'tools']

export interface Config {
  failOnStartupError: boolean
}

export const Config: z<Config> = z.object({
  failOnStartupError: z.boolean().default(false),
})

interface ProjectStdioServer {
  transport: 'stdio'
  command: string
  args: string[]
  env: Record<string, string>
  cwd: string
}

interface ProjectHttpServer {
  transport: 'streamable-http'
  url: string
  headers: Record<string, string>
}

export interface ProjectMcpServer {
  name: string
  config: ProjectStdioServer | ProjectHttpServer
}

const CONFIG_FILE = '.mcp.json'
const SERVER_NAME_MAX = 32
const INSTANCE_HASH_LENGTH = 8

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalStringArray(value: unknown, field: string, path: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`project-mcp: ${path} field "${field}" must be an array of strings`)
  }
  return [...value]
}

function optionalStringRecord(value: unknown, field: string, path: string): Record<string, string> {
  if (value === undefined) return {}
  if (!isRecord(value) || Object.values(value).some(item => typeof item !== 'string')) {
    throw new Error(`project-mcp: ${path} field "${field}" must be an object of string values`)
  }
  return { ...value } as Record<string, string>
}

function parseServer(name: string, value: unknown, projectRoot: string, path: string): ProjectMcpServer | undefined {
  const location = `${path} mcpServers.${name}`
  if (!isRecord(value)) throw new Error(`project-mcp: ${location} must be an object`)
  if (value.disabled === true) return undefined
  if (value.disabled !== undefined && value.disabled !== false) {
    throw new Error(`project-mcp: ${location} field "disabled" must be a boolean`)
  }

  const command = value.command
  const url = value.url
  if (typeof command === 'string' && url === undefined) {
    if (value.type !== undefined && value.type !== 'stdio') {
      throw new Error(`project-mcp: ${location} has command but unsupported type "${String(value.type)}"`)
    }
    const configuredCwd = value.cwd
    if (configuredCwd !== undefined && typeof configuredCwd !== 'string') {
      throw new Error(`project-mcp: ${location} field "cwd" must be a string`)
    }
    const cwd = configuredCwd === undefined
      ? projectRoot
      : isAbsolute(configuredCwd) ? configuredCwd : resolve(projectRoot, configuredCwd)
    return {
      name,
      config: {
        transport: 'stdio',
        command,
        args: optionalStringArray(value.args, 'args', location),
        env: optionalStringRecord(value.env, 'env', location),
        cwd,
      },
    }
  }

  if (typeof url === 'string' && command === undefined) {
    if (value.type !== undefined && value.type !== 'http' && value.type !== 'streamable-http') {
      throw new Error(`project-mcp: ${location} has url but unsupported type "${String(value.type)}"`)
    }
    return {
      name,
      config: {
        transport: 'streamable-http',
        url,
        headers: optionalStringRecord(value.headers, 'headers', location),
      },
    }
  }

  throw new Error(`project-mcp: ${location} must declare exactly one of "command" or "url"`)
}

export function parseProjectMcpConfig(source: string, projectRoot: string, path = resolve(projectRoot, CONFIG_FILE)): ProjectMcpServer[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch (error) {
    throw new Error(`project-mcp: ${path} is not valid JSON`, { cause: error })
  }
  if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) {
    throw new Error(`project-mcp: ${path} must contain an "mcpServers" object`)
  }

  const servers: ProjectMcpServer[] = []
  for (const [serverName, server] of Object.entries(parsed.mcpServers)) {
    const normalized = parseServer(serverName, server, projectRoot, path)
    if (normalized !== undefined) servers.push(normalized)
  }
  return servers
}

export function scopedServerName(serverName: string, agentId: string): string {
  const normalized = serverName.replace(/[^A-Za-z0-9_-]/g, '_') || 'server'
  const hash = createHash('sha256').update(agentId).update('\0').update(serverName).digest('hex').slice(0, INSTANCE_HASH_LENGTH)
  const baseLength = SERVER_NAME_MAX - INSTANCE_HASH_LENGTH - 1
  return `${normalized.slice(0, baseLength)}-${hash}`
}

async function readProjectServers(cwd: string): Promise<ProjectMcpServer[]> {
  const path = resolve(cwd, CONFIG_FILE)
  let source: string
  try {
    source = await readFile(path, 'utf8')
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return []
    throw error
  }
  return parseProjectMcpConfig(source, cwd, path)
}

async function loadAgentServers(agent: Agent, config: Config): Promise<void> {
  const cwd = agent.session.header.cwd
  if (cwd === undefined) return
  const servers = await readProjectServers(cwd)
  await Promise.all(servers.map(async (server) => {
    const serverName = scopedServerName(server.name, String(agent.id))
    const clientConfig: McpClient.Config = server.config.transport === 'stdio'
      ? {
          ...server.config,
          serverName,
          toolCallTimeoutMs: 60_000,
          failOnStartupError: config.failOnStartupError,
        }
      : {
          ...server.config,
          serverName,
          toolCallTimeoutMs: 60_000,
          failOnStartupError: config.failOnStartupError,
        }
    await agent.ctx.plugin(McpClient, clientConfig).await()
  }))
}

export function apply(ctx: Context, config: Config): void {
  const loads = new WeakMap<Agent, Promise<void>>()
  const ready = new WeakSet<Agent>()

  async function ensureLoaded(agent: Agent): Promise<void> {
    let load = loads.get(agent)
    if (load === undefined) {
      load = loadAgentServers(agent, config)
      loads.set(agent, load)
    }
    try {
      await load
      ready.add(agent)
    } catch (error) {
      loads.delete(agent)
      throw error
    }
  }

  // SystemPrompt snapshots tool providers before agent/pre-step. Load before
  // that snapshot can become authoritative, then reassemble once so the first
  // model request already contains every project MCP tool. Prepending keeps the
  // recursive assembly from running other waterfall listeners twice.
  ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
    const agent = context.agent
    if (agent === undefined) return next()
    const wasReady = ready.has(agent)
    await ensureLoaded(agent)
    if (wasReady) return next()
    return ctx.systemPrompt.assemble(context)
  }, true)
}
