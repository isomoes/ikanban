import { createMemo } from "solid-js"
import { useLocation } from "@solidjs/router"
import type { ServerConnection } from "@/runtime/server/registry"
import { requireServerKey } from "@/shell/routes/session"
import { stripBase } from "@/shell/routes/base"

export type LayoutRoute =
  | { type: "home" }
  | { type: "settings" }
  | { type: "draft"; draftID: string }
  | { type: "session"; sessionId: string; server: ServerConnection.Key }

export const currentRoute = (pathname: string, search: string): LayoutRoute => {
  const parts = (stripBase(pathname) ?? pathname).split("/").filter(Boolean)
  if (parts.length === 0) return { type: "home" }
  if (parts[0] === "settings") return { type: "settings" }

  if (parts[0] === "new-session") {
    const draftID = new URLSearchParams(search).get("draftId")
    if (!draftID) return { type: "home" }
    return { type: "draft", draftID }
  }

  if (parts[0] === "server" && parts[2] === "session" && parts[3]) {
    return {
      type: "session",
      sessionId: parts[3],
      server: requireServerKey(parts[1]),
    }
  }

  throw new Error("Unrecognised route!")
}

export const useCurrentRoute = () => {
  const location = useLocation()
  return createMemo(() => currentRoute(location.pathname, location.search))
}
