import { readFileSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-commands'

export const name = 'markdown-command'
export const inject = ['commands']

export interface Config {
  path?: string
  name?: string
  description?: string
}

export const Config: z<Config> = z.object({
  path: z.string(),
  name: z.string(),
  description: z.string(),
})

interface MarkdownCommand {
  description?: string
  prompt: string
}

const COMMAND_NAME = /^[a-z0-9_-]+$/
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/
const DEFAULT_COMMAND_PATH = fileURLToPath(new URL('../preset/ikanban/commands/commit-message.md', import.meta.url))

function parseMarkdownCommand(source: string): MarkdownCommand {
  const match = FRONTMATTER.exec(source)
  if (match === null) return { prompt: source }

  let description: string | undefined
  for (const line of (match[1] ?? '').split(/\r?\n/)) {
    const field = /^description:\s*(.*?)\s*$/.exec(line)
    const value = field?.[1]
    if (value !== undefined && value !== '') {
      description = value.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2')
      break
    }
  }
  const prompt = source.slice(match[0].length)
  return description === undefined ? { prompt } : { description, prompt }
}

function commandName(path: string, configured?: string): string {
  const candidate = configured ?? basename(path, extname(path))
  if (!COMMAND_NAME.test(candidate)) {
    throw new Error(`markdown-command: invalid command name "${candidate}"`)
  }
  return candidate
}

export function apply(ctx: Context, config: Config = {}): void {
  const path = config.path === undefined ? DEFAULT_COMMAND_PATH : resolve(config.path)
  const initial = parseMarkdownCommand(readFileSync(path, 'utf8'))
  const command = commandName(path, config.name)
  const description = config.description ?? initial.description ?? `Run prompt from ${basename(path)}`

  ctx.effect(() => ctx.commands.register({
    name: command,
    description,
    input: { hint: '[instructions]' },
    handler: ({ agent, rawInput }) => {
      const current = parseMarkdownCommand(readFileSync(path, 'utf8'))
      const prompt = current.prompt.replaceAll('$ARGUMENTS', rawInput.trim())
      agent.steer(createUserMessage({
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'user' },
      }))
      return { kind: 'success', text: `Started /${command}.` }
    },
  }))
}

export const internals = { parseMarkdownCommand, commandName }
