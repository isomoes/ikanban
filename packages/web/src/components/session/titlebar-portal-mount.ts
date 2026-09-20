import { createSignal, onCleanup } from "solid-js"

export function createTitlebarPortalMount(id: string) {
  const [mount, setMount] = createSignal<HTMLElement | undefined>()

  if (typeof document !== "object") return mount

  const sync = () => {
    const next = document.getElementById(id) ?? undefined
    setMount((current) => (current === next ? current : next))
  }

  sync()

  if (typeof MutationObserver === "undefined") return mount

  const root = document.body ?? document.documentElement
  if (!root) return mount

  const observer = new MutationObserver(sync)
  observer.observe(root, { childList: true, subtree: true })
  onCleanup(() => observer.disconnect())

  return mount
}
