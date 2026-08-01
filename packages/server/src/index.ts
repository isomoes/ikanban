#!/usr/bin/env bun
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createIkanbanHandler, toIkanbanApiRequest } from "./http"
import { PiRuntime } from "./pi-runtime"
import type { AgentRuntime } from "./protocol"
import { createStaticHandler } from "./static"

type DisposableRuntime = AgentRuntime & { dispose(): Promise<void> }
type Server = {
  url: URL
  stop(closeActiveConnections?: boolean): void | Promise<void>
}
type ServeOptions = {
  hostname?: string
  port: number
  fetch(request: Request): Response | Promise<Response>
}
type Signal = "SIGINT" | "SIGTERM"

export type StartOptions = {
  args?: string[]
  cwd?: string
  root?: string
  hostname?: string
  createRuntime?: (roots: string[]) => DisposableRuntime
  serve?: (options: ServeOptions) => Server
  registerSignal?: (signal: Signal, listener: () => void) => void | (() => void)
}

export function resolveWebRoot() {
  return resolve(dirname(fileURLToPath(import.meta.resolve("ikanban-web"))), "../dist")
}

export function parseArgs(args: string[], cwd = process.cwd()) {
  let port = 3000
  const roots: string[] = []

  for (let index = 0; index < args.length; index++) {
    const flag = args[index]
    const value = args[++index]
    if (flag !== "--port" && flag !== "--project") throw new Error(`Unknown argument: ${flag}`)
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`)
    if (flag === "--project") {
      roots.push(resolve(cwd, value))
      continue
    }
    port = Number(value)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`Invalid port: ${value}`)
  }

  return { port, roots: roots.length > 0 ? roots : [resolve(cwd)] }
}

export function startIkanban(options: StartOptions = {}) {
  const { port, roots } = parseArgs(options.args ?? process.argv.slice(2), options.cwd)
  const runtime = options.createRuntime?.(roots) ?? new PiRuntime({ roots })
  const api = createIkanbanHandler(runtime)
  const fetch = createStaticHandler({
    root: options.root ?? resolveWebRoot(),
    api: (request) => {
      const apiRequest = toIkanbanApiRequest(request)
      return apiRequest ? api(apiRequest) : undefined
    },
  })
  const server = (options.serve ?? ((serveOptions) => Bun.serve(serveOptions)))({
    hostname: options.hostname,
    port,
    fetch,
  })

  let stopped = false
  const unregister: Array<() => void> = []
  const shutdown = async () => {
    if (stopped) return
    stopped = true
    for (const remove of unregister) remove()
    try {
      await server.stop(true)
    } finally {
      await runtime.dispose()
    }
  }
  const registerSignal = options.registerSignal ?? ((signal: Signal, listener: () => void) => {
    process.once(signal, listener)
    return () => process.off(signal, listener)
  })
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    const remove = registerSignal(signal, () => { void shutdown() })
    if (remove) unregister.push(remove)
  }

  return { roots, runtime, server, shutdown }
}

if (import.meta.main) {
  try {
    const service = startIkanban()
    console.log(`iKanban running at ${new URL("/ikanban/", service.server.url)}`)
    console.log("Allowed project roots:")
    for (const root of service.roots) console.log(`  ${root}`)
    console.log("Press Ctrl+C to stop")
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
