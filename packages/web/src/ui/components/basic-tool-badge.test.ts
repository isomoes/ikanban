import { describe, expect, test } from "bun:test"
import { toolBadge } from "./basic-tool"

const toolSource = await Bun.file(new URL("./basic-tool.tsx", import.meta.url)).text()
const toolStyles = await Bun.file(new URL("./basic-tool.css", import.meta.url)).text()
const partSource = await Bun.file(new URL("./message-part.tsx", import.meta.url)).text()

describe("tool type badges", () => {
  test("renders a compact semantic badge for tool calls", () => {
    expect(toolSource).toContain('data-slot="basic-tool-tool-badge"')
    expect(toolSource).toContain("toolBadge(props.tool)")
    expect(toolStyles).toContain('[data-slot="basic-tool-tool-badge"]')
  })

  test("labels generic tools as MCP and preserves explicit skill and agent types", () => {
    expect(toolSource).toContain('badge="MCP"')
    expect(partSource).toContain('tool="skill"')
    expect(partSource).toContain('tool="task"')
  })

  test("uses concise labels for built-ins and reserves MCP for external tools", () => {
    expect(toolBadge("read")).toBe("READ")
    expect(toolBadge("apply_patch")).toBe("PATCH")
    expect(toolBadge("skill")).toBe("SKILL")
    expect(toolBadge("chrome-devtools_take_snapshot")).toBe("MCP")
  })

  test("hides redundant built-in names while preserving external and skill names", () => {
    expect(toolSource).toContain('data-hide-title={compactTitle() ? "true" : undefined}')
    expect(toolStyles).toContain('[data-hide-title="true"]')
    expect(toolSource).toContain('return badge !== "MCP" && badge !== "SKILL" && badge !== "AGENT"')
  })
})
