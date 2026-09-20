export const normalizeWheelDelta = (input: { deltaY: number; deltaMode: number; rootHeight: number }) => {
  if (input.deltaMode === 1) return input.deltaY * 40
  if (input.deltaMode === 2) return input.deltaY * input.rootHeight
  return input.deltaY
}

export const scrollElementByKey = (root: HTMLElement, key: string) => {
  const page = root.clientHeight * 0.8

  if (key === "ArrowUp" || key === "ArrowDown") {
    root.scrollBy({ top: key === "ArrowUp" ? -40 : 40, behavior: "smooth" })
    return true
  }

  if (key === "PageUp" || key === "PageDown") {
    root.scrollBy({ top: key === "PageUp" ? -page : page, behavior: "smooth" })
    return true
  }

  if (key === "Home" || key === "End") {
    root.scrollTo({ top: key === "Home" ? 0 : root.scrollHeight, behavior: "smooth" })
    return true
  }

  return false
}

export const shouldMarkBoundaryGesture = (input: {
  delta: number
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}) => {
  const max = input.scrollHeight - input.clientHeight
  if (max <= 1) return true
  if (!input.delta) return false

  if (input.delta < 0) return input.scrollTop + input.delta <= 0

  const remaining = max - input.scrollTop
  return input.delta > remaining
}
