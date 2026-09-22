import { useLocation } from "@solidjs/router"
import { createEffect } from "solid-js"
import { stripBase } from "@/shell/routes/base"

const LAST_ROUTE_KEY = "ikanban.v2.pwa.last-route"

export function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  )
}

export function restorePwaRoute() {
  if (stripBase(location.pathname) !== "/" || location.search || location.hash) return
  try {
    const value = localStorage.getItem(LAST_ROUTE_KEY)
    if (!value) return
    const url = new URL(value, location.origin)
    if (url.origin !== location.origin || url.searchParams.has("auth_token")) return
    const pathname = stripBase(url.pathname)
    if (
      pathname !== "/" &&
      pathname !== "/new-session" &&
      (!pathname || !/^\/server\/[^/]+\/session\/[^/]+$/.test(pathname))
    )
      return
    history.replaceState(history.state, "", url.pathname + url.search + url.hash)
  } catch {
    // Storage may be unavailable; keep the launch URL in that case.
  }
}

export function PwaRoutePersistence() {
  const location = useLocation()
  createEffect(() => {
    if (stripBase(location.pathname) === undefined || new URLSearchParams(location.search).has("auth_token")) return
    const value = location.pathname + location.search + location.hash
    try {
      localStorage.setItem(LAST_ROUTE_KEY, value)
    } catch {
      // Navigation must still work when storage is unavailable or full.
    }
  })
  return null
}
