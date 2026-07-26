import { describe, expect, test } from "bun:test"
import { toolBadge } from "./basic-tool"

const toolSource = await Bun.file(new URL("./basic-tool.tsx", import.meta.url)).text()
const toolStyles = await Bun.file(new URL("./basic-tool.css", import.meta.url)).text()
const partSource = await Bun.file(new URL("./message-part.tsx", import.meta.url)).text()
const partStyles = await Bun.file(new URL("./message-part.css", import.meta.url)).text()

describe("tool type badges", () => {
  test("renders a compact semantic badge for tool calls", () => {
    expect(toolSource).toContain('data-slot="basic-tool-tool-badge"')
    expect(toolSource).toContain("toolBadge(props.tool)")
    expect(toolStyles).toContain('[data-slot="basic-tool-tool-badge"]')
    expect(toolStyles).not.toContain('[data-slot="basic-tool-tool-badge"] {\n  width:')
    expect(toolStyles).toMatch(/\[data-slot="basic-tool-tool-trigger-content"\]\s*{[^}]*gap: 6px;/s)
    expect(toolStyles).toMatch(/\[data-slot="basic-tool-tool-info-structured"\]\s*{[^}]*gap: 0;/s)
    expect(toolStyles).toMatch(/\[data-slot="basic-tool-tool-info-main"\]\s*{[^}]*gap: 0;/s)
  })

  test("uses the same compact footprint for context and expanded tool rows", () => {
    expect(partSource).toContain('badge="CTX"')
    expect(partSource).toContain('class="flex items-center gap-1.5 min-w-0"')
    expect(partStyles).toMatch(/\[data-component="context-tool-group-list"\]\s*{[^}]*padding: 0;[^}]*gap: 0;/s)
    expect(partStyles).toMatch(/\[data-slot="context-tool-group-item"\]\s*{[^}]*padding: 0;/s)
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
