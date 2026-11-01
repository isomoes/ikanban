import { isModifierKey, LEADER_TIMEOUT, matchKeybind, parseKeybind } from "./keybind"

/** Resolve sequences before editors/terminals see their unmodified suffix. */
export function createCommandKeyboard(input: {
  leader: () => string
  enabled: () => boolean
  resolve: (event: KeyboardEvent, leader: boolean) => (() => void) | undefined
}) {
  let pending = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const held = new Set<string>()
  const key = (event: KeyboardEvent) => event.code || event.key
  const consume = (event: KeyboardEvent) => {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const cancel = () => {
    pending = false
    clearTimeout(timer)
    timer = undefined
  }
  const reset = () => {
    cancel()
    held.clear()
  }

  return {
    reset,
    keyup(event: KeyboardEvent) {
      // Extensions can consume Escape's keydown while leaving its keyup to the page.
      if (event.key === "Escape") cancel()
      if (held.delete(key(event))) consume(event)
    },
    keydown(event: KeyboardEvent) {
      if (!input.enabled() || event.defaultPrevented || event.isComposing || event.keyCode === 229) {
        reset()
        return
      }
      if (event.repeat && held.has(key(event))) {
        consume(event)
        return
      }
      if (isModifierKey(event.key)) return

      if (matchKeybind(parseKeybind(input.leader()), event)) {
        consume(event)
        held.add(key(event))
        if (event.repeat) return
        cancel()
        pending = true
        timer = setTimeout(cancel, LEADER_TIMEOUT)
        return
      }

      if (pending) {
        consume(event)
        held.add(key(event))
        if (event.repeat) return
        cancel()
        if (event.key !== "Escape") input.resolve(event, true)?.()
        return
      }

      const run = input.resolve(event, false)
      if (!run) return
      consume(event)
      run()
    },
  }
}
