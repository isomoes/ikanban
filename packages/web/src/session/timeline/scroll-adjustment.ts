import type { VirtualItem } from "@tanstack/solid-virtual"

type ScrollState = {
  range: { startIndex: number } | null
  scrollOffset: number | null
  scrollAdjustments: number
  isScrolling: boolean
  options: { scrollMargin: number }
}

export function createTimelineScrollAdjustment(input: {
  pinned: () => boolean
  touching: () => boolean
  addedKeys: ReadonlySet<string>
}) {
  let pending = 0

  return {
    shouldAdjust(item: Pick<VirtualItem, "key" | "index" | "end">, delta: number, instance: ScrollState) {
      // Prepended content can resize repeatedly. Only compensate once it is
      // entirely above the logical viewport; existing rows use the visible fold.
      const first = instance.range?.startIndex
      const adjust = input.addedKeys.has(String(item.key))
        ? item.end <= (instance.scrollOffset ?? 0) + instance.scrollAdjustments + instance.options.scrollMargin
        : first !== undefined && item.index < first
      if (input.pinned() || (!input.touching() && !instance.isScrolling)) return adjust
      // A native scroll write would cancel keyboard/extension smooth scrolling
      // (and interrupt touch momentum). Translate content until scrolling settles.
      if (adjust) pending += delta
      return false
    },
    take() {
      const delta = pending
      pending = 0
      return delta
    },
  }
}
