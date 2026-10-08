import { describe, expect, test } from "bun:test"
import { GROUPS, filteredFor, groupFor, groupedFor, signatures, type KeybindMeta } from "./catalog"

describe("keybind catalog", () => {
  test("groups commands by id prefix", () => {
    expect(groupFor("command.palette")).toBe("General")
    expect(groupFor("terminal.new")).toBe("Terminal")
    expect(groupFor("model.choose")).toBe("Model and agent")
    expect(groupFor("fileTree.toggle")).toBe("Navigation")
    expect(groupFor("prompt.focus")).toBe("Prompt")
    expect(groupFor("session.new")).toBe("Session")
    expect(groupFor("unknown.thing")).toBe("General")
  })

  test("builds signatures from keybind config", () => {
    expect(signatures(undefined)).toEqual([])
    expect(signatures("ctrl+shift+k")).toEqual(["ctrl+shift+k"])
    expect(signatures("alt+a,meta+b")).toEqual(["alt+a", "meta+b"])
  })

  test("sorts grouped ids by title and filters by query", () => {
    const list = new Map<string, KeybindMeta>([
      ["session.b", { title: "Beta", group: "Session" }],
      ["session.a", { title: "Alpha", group: "Session" }],
      ["terminal.new", { title: "New terminal", group: "Terminal" }],
    ])
    const grouped = groupedFor(list)
    expect(grouped.get("Session")).toEqual(["session.a", "session.b"])
    expect(filteredFor("", list, grouped, () => "")).toBe(grouped)
    const filtered = filteredFor("terminal", list, grouped, () => "")
    expect(filtered.get("Terminal")).toEqual(["terminal.new"])
    expect(filtered.get("Session")).toEqual([])
    expect([...filtered.keys()]).toEqual(GROUPS)
  })
})
