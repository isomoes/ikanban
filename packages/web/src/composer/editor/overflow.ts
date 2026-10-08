import { onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"

export function createControlsOverflow() {
  let viewport!: HTMLDivElement
  let content!: HTMLDivElement
  const [overflow, setOverflow] = createStore({ start: false, end: false })
  const update = () => {
    const offset = Math.abs(viewport.scrollLeft)
    setOverflow({
      start: offset > 1,
      end: viewport.scrollWidth - viewport.clientWidth - offset > 1,
    })
  }
  onMount(() => {
    const observer = new ResizeObserver(update)
    observer.observe(viewport)
    observer.observe(content)
    update()
    onCleanup(() => observer.disconnect())
  })
  return {
    overflow,
    update,
    viewportRef: (element: HTMLDivElement) => (viewport = element),
    contentRef: (element: HTMLDivElement) => (content = element),
  }
}
