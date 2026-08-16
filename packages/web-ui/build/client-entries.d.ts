export interface ClientMetadata {
  readonly inject: readonly string[]
  readonly platform: string
  readonly immediately?: boolean
}

export interface ClientEntry {
  readonly id: string
  readonly stockId: string
  readonly virtualId: string
  readonly source: string
  readonly host?: string
  readonly client: ClientMetadata
}

export function discoverClientEntries(options: {
  readonly packageRoot: string
}): Promise<ClientEntry[]>
