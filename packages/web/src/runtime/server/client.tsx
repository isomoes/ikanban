import type { OpenCodeEvent } from "@opencode/client/promise"
import { createClientConnection, createPtyClient, type ClientConnectionStatus } from "@opencode/client/solid"
import { createGlobalEmitter } from "@solid-primitives/event-bus"
import { type Accessor, onCleanup } from "solid-js"
import { createApiForServer, type ServerApi } from "@/runtime/server/api"
import { ServerConnection } from "./registry"
import { createRefCountMap } from "@/runtime/server/refcount"
import { createRequestQueue } from "@/runtime/server/request-queue"
import { ServerScope } from "@/runtime/server/scope"
import { useServer } from "./current"

type OpenCodeEventMap = { [Type in OpenCodeEvent["type"]]: Extract<OpenCodeEvent, { type: Type }> }

export type OpenCodeEventStream = {
  on<Type extends OpenCodeEvent["type"]>(type: Type, handler: (event: OpenCodeEventMap[Type]) => void): VoidFunction
  listen(handler: (event: OpenCodeEvent) => void): VoidFunction
}

type OpenCodeEventSource = OpenCodeEventStream & {
  location(directory: string): OpenCodeEventStream
}

export function createOpenCodeEventSource() {
  const emitter = createGlobalEmitter<OpenCodeEventMap>()

  function stream(directory?: string): OpenCodeEventStream {
    return {
      on(type, handler) {
        return emitter.on(type, (event) => {
          if (directory !== undefined && event.location?.directory !== directory) return
          handler(event)
        })
      },
      listen(handler) {
        return emitter.listen((event) => {
          if (directory !== undefined && event.details.location?.directory !== directory) return
          handler(event.details)
        })
      },
    }
  }

  const event: OpenCodeEventSource = {
    ...stream(),
    location: (directory) => stream(directory),
  }

  onCleanup(() => emitter.clear())

  return {
    event,
    publish(event: OpenCodeEvent) {
      emitter.emit(event.type, event)
    },
  }
}

export type ServerConnectionStatus = ClientConnectionStatus
type ServerSDKBase = {
  server: ServerConnection.Http
  scope: ServerScope
  url: string
  api: ServerApi
  pty: ReturnType<typeof createPtyClient>
  connection: {
    status: Accessor<ServerConnectionStatus>
    attempt: Accessor<number>
    error: Accessor<string | undefined>
  }
  event: OpenCodeEventSource
}

function createServerSdkContextBase(server: ServerConnection.Http, scope: ServerScope): ServerSDKBase {
  const transport = createServerTransport({ http: server.http })
  const events = createOpenCodeEventSource()

  const connection = createClientConnection(transport.api, {
    flushInterval: 16,
    pageLifecycle: true,
    onEvent(event) {
      events.publish(event)
    },
    log: {
      info(message, data) {
        if (message !== "event stream disconnected") return
        console.info("[global-sdk] event stream disconnected", { url: transport.url, ...data })
      },
    },
  })

  return {
    server,
    scope,
    get url() {
      return transport.url
    },
    get api() {
      return transport.api
    },
    get pty() {
      return transport.pty
    },
    connection,
    event: events.event,
  }
}

export function createServerTransport(input: { http: ServerConnection.HttpBase }): {
  readonly url: string
  readonly api: ServerApi
  readonly pty: ReturnType<typeof createPtyClient>
} {
  const queue = createRequestQueue({ fetch: globalThis.fetch })
  const api = createApiForServer({ server: input.http, fetch: queue.fetch })
  return { url: input.http.url, api, pty: createPtyClient(api, { url: input.http.url }) }
}

export type ServerSDK = ServerSDKBase & {
  ensureDirSdkContext: (directory: string) => ReturnType<typeof createDirSdkContext>
}

export function createServerSdkContext(server: ServerConnection.Http, scope: ServerScope): ServerSDK {
  const sdk = createServerSdkContextBase(server, scope)
  return Object.assign(sdk, {
    ensureDirSdkContext: createRefCountMap((dir) => createDirSdkContext(dir, sdk)),
  })
}

export const useServerSDK = () => {
  const server = useServer()
  return server.ctx.sdk
}

export type LocationContext = {
  directory: string
  event: OpenCodeEventStream
}

function createDirSdkContext(directory: string, serverSDK: ServerSDKBase): LocationContext {
  return {
    directory,
    event: serverSDK.event.location(directory),
  }
}
