import { describe, expect, test } from "bun:test"

const sessionSource = await Bun.file(new URL("../session.tsx", import.meta.url)).text()
const timelineSource = await Bun.file(new URL("./message-timeline.tsx", import.meta.url)).text()
const newViewSource = await Bun.file(new URL("../../components/session/session-new-view.tsx", import.meta.url)).text()

describe("session workspace structure", () => {
  test("exposes session body states and status rail", () => {
    expect(timelineSource).toContain('data-slot="session-status-rail"')
    expect(sessionSource).toContain('data-state="loading"')
    expect(sessionSource).toContain('data-state="empty"')
    expect(sessionSource).toContain('data-state="ready"')
  })

  test("uses the existing worktree change callback", () => {
    expect(newViewSource).toContain("props.onWorktreeChange")
    expect(newViewSource).toContain("options={options()}")
    expect(newViewSource).toContain("current={current()}")
  })
})
