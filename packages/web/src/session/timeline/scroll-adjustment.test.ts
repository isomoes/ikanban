import { expect, test } from "bun:test"
import { Virtualizer } from "@tanstack/solid-virtual"
import { createTimelineScrollAdjustment } from "./scroll-adjustment"

function setup(input: { pinned?: boolean; touching?: boolean; addedKeys?: string[] } = {}) {
  const writes: number[] = []
  const adjustment = createTimelineScrollAdjustment({
    pinned: () => input.pinned ?? false,
    touching: () => input.touching ?? false,
    addedKeys: new Set(input.addedKeys),
  })
  const virtualizer = new Virtualizer<HTMLDivElement, HTMLDivElement>({
    count: 10,
    getItemKey: (index) => `row-${index}`,
    estimateSize: () => 60,
    initialOffset: 180,
    initialRect: { width: 800, height: 120 },
    getScrollElement: () => null,
    scrollToFn: (offset, options) => writes.push(offset + (options.adjustments ?? 0)),
    observeElementRect: () => {},
    observeElementOffset: () => {},
  })
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = adjustment.shouldAdjust
  virtualizer.getVirtualItems()
  return { virtualizer, adjustment, writes }
}

test("scrolling row resizes preserve the visual anchor without interrupting native animation", () => {
  const { virtualizer, adjustment, writes } = setup()
  virtualizer.isScrolling = true
  virtualizer.resizeItem(0, 100)

  expect(writes).toEqual([])
  expect(virtualizer.itemSizeCache.get("row-0")).toBe(100)
  expect(virtualizer.getTotalSize()).toBe(640)
  const delta = adjustment.take()
  expect(delta).toBe(40)
  // The view translates rows by -delta and reports this logical offset, keeping
  // the same row at the visible fold while native scrollTop remains unchanged.
  virtualizer.scrollOffset = 180 + delta
  expect(virtualizer.getVirtualItems().find((item) => item.index === 3)?.start).toBe(220)
  expect(virtualizer.calculateRange()?.startIndex).toBe(3)
  expect(adjustment.take()).toBe(0)

  virtualizer.isScrolling = false
  virtualizer.resizeItem(0, 120)
  expect(writes).toEqual([240])
  expect(adjustment.take()).toBe(0)
})

test("deferred positive and negative resizes accumulate only above the visible fold", () => {
  const { virtualizer, adjustment, writes } = setup()
  virtualizer.isScrolling = true
  virtualizer.resizeItem(0, 100)
  virtualizer.resizeItem(1, 40)
  virtualizer.resizeItem(5, 120)
  expect(writes).toEqual([])
  expect(adjustment.take()).toBe(20)
})

test("idle and pinned timelines retain native anchoring", () => {
  for (const pinned of [false, true]) {
    const { virtualizer, adjustment, writes } = setup({ pinned })
    virtualizer.isScrolling = pinned
    virtualizer.resizeItem(0, 100)
    expect(writes).toEqual([220])
    expect(adjustment.take()).toBe(0)
  }
})

test("a held touch defers compensation before the first scroll event", () => {
  const { virtualizer, adjustment, writes } = setup({ touching: true })
  virtualizer.resizeItem(0, 100)
  expect(writes).toEqual([])
  expect(adjustment.take()).toBe(40)
})

test("prepended rows compensate only when entirely above the logical viewport", () => {
  const { virtualizer, adjustment, writes } = setup({ addedKeys: ["row-0", "row-3"] })
  virtualizer.isScrolling = true
  virtualizer.resizeItem(0, 100)
  virtualizer.resizeItem(3, 100)
  expect(writes).toEqual([])
  expect(adjustment.take()).toBe(40)
})
