import { describe, expect, test } from "bun:test"
import { normalizeWheelDelta, scrollElementByKey, shouldMarkBoundaryGesture } from "./message-gesture"

describe("normalizeWheelDelta", () => {
  test("converts line mode to px", () => {
    expect(normalizeWheelDelta({ deltaY: 3, deltaMode: 1, rootHeight: 500 })).toBe(120)
  })

  test("converts page mode to container height", () => {
    expect(normalizeWheelDelta({ deltaY: -1, deltaMode: 2, rootHeight: 600 })).toBe(-600)
  })

  test("keeps pixel mode unchanged", () => {
    expect(normalizeWheelDelta({ deltaY: 16, deltaMode: 0, rootHeight: 600 })).toBe(16)
  })
})

describe("shouldMarkBoundaryGesture", () => {
  test("marks when nested scroller cannot scroll", () => {
    expect(
      shouldMarkBoundaryGesture({
        delta: 20,
        scrollTop: 0,
        scrollHeight: 300,
        clientHeight: 300,
      }),
    ).toBe(true)
  })

  test("marks when scrolling beyond top boundary", () => {
    expect(
      shouldMarkBoundaryGesture({
        delta: -40,
        scrollTop: 10,
        scrollHeight: 1000,
        clientHeight: 400,
      }),
    ).toBe(true)
  })

  test("marks when scrolling beyond bottom boundary", () => {
    expect(
      shouldMarkBoundaryGesture({
        delta: 50,
        scrollTop: 580,
        scrollHeight: 1000,
        clientHeight: 400,
      }),
    ).toBe(true)
  })

  test("does not mark when nested scroller can consume movement", () => {
    expect(
      shouldMarkBoundaryGesture({
        delta: 20,
        scrollTop: 200,
        scrollHeight: 1000,
        clientHeight: 400,
      }),
    ).toBe(false)
  })
})

describe("scrollElementByKey", () => {
  test("scrolls by a line or page for keyboard navigation", () => {
    const calls: number[] = []
    const root = document.createElement("div")
    Object.defineProperty(root, "clientHeight", { value: 500 })
    root.scrollBy = (({ top }: ScrollToOptions) => {
      calls.push(top ?? 0)
    }) as typeof root.scrollBy

    expect(scrollElementByKey(root, "ArrowUp")).toBe(true)
    expect(scrollElementByKey(root, "ArrowDown")).toBe(true)
    expect(scrollElementByKey(root, "PageUp")).toBe(true)
    expect(scrollElementByKey(root, "PageDown")).toBe(true)
    expect(scrollElementByKey(root, "Enter")).toBe(false)
    expect(calls).toEqual([-40, 40, -400, 400])
  })
})
