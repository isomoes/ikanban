import { describe, expect, test } from "bun:test"

const sessionSource = await Bun.file(new URL("../session.tsx", import.meta.url)).text()
const timelineSource = await Bun.file(new URL("./message-timeline.tsx", import.meta.url)).text()
const newViewSource = await Bun.file(new URL("../../components/session/session-new-view.tsx", import.meta.url)).text()
const cockpitStyles = await Bun.file(new URL("./session-cockpit.css", import.meta.url)).text()
const turnStyles = await Bun.file(new URL("../../ui/components/session-turn.css", import.meta.url)).text()
const messageStyles = await Bun.file(new URL("../../ui/components/message-part.css", import.meta.url)).text()

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

  test("uses a compact conversation rhythm", () => {
    expect(cockpitStyles).toMatch(/\.session-cockpit__turns\s*{\s*gap: 8px;/)
    expect(turnStyles).toMatch(/\[data-slot="session-turn-message-container"\][^{]*{[^}]*gap: 0;/s)
    expect(turnStyles).toMatch(/\[data-slot="session-turn-thinking"\]\s*{[^}]*gap: 8px;/s)
    expect(turnStyles).toMatch(/\[data-slot="session-turn-assistant-content"\][^{]*{[^}]*gap: 0;/s)
    expect(turnStyles).toMatch(
      /> \[data-component="text-part"\]:first-child\s*{[^}]*margin-top: 0;/s,
    )
    expect(messageStyles).toMatch(/\[data-component="assistant-message"\]\s*{[^}]*gap: 0;/s)
  })
})
