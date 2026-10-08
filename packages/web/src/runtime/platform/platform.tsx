import { createSimpleContext } from "@ikanban/ui/context"
import { ServerConnection } from "@/runtime/server/registry"
import type { DraftStore } from "@/runtime/persistence/drafts"

export type Platform = {
  /** App version */
  version?: string

  /** Open a web or mail URL in the default system application */
  openExternal(url: string): void

  /** Restart the app  */
  restart(): Promise<void>

  /** Send a system notification */
  notify(title: string, description?: string, onClick?: () => void): Promise<void>

  /** Prompt drafts, history, and their blobs. */
  draftStore?: DraftStore

  /** Get the configured default server URL (platform-specific) */
  getDefaultServer?(): Promise<ServerConnection.Key | null>

  /** Set the default server URL to use on app startup (platform-specific) */
  setDefaultServer?(url: ServerConnection.Key | null): Promise<void> | void
}

export const { use: usePlatform, provider: PlatformProvider } = createSimpleContext({
  name: "Platform",
  init: (props: { value: Platform }) => {
    return props.value
  },
})
