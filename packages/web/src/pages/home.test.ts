import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(join(import.meta.dir, "home.tsx"), "utf8")

describe("Home accessibility structure", () => {
  test("exposes stable page and board regions for the cockpit layout", () => {
    expect(source).toContain('data-page="home"')
    expect(source).toContain('data-slot="home-board"')
    expect(source).toContain('aria-live="polite"')
  })

  test("names session actions with the session title", () => {
    expect(source).toContain('aria-label={`${language.t("home.sessionBoard.openSession")}: ${card.session.title}`}')
  })

  test("localizes archive actions and exposes server health text", () => {
    expect(source).toContain('aria-label={`${language.t("common.archive")}: ${card.session.title}`}')
    expect(source).toContain('class="sr-only">{serverHealthLabel()}</span>')
  })

  test("does not reserve desktop column height on mobile", () => {
    expect(source).toContain("min-h-0 lg:min-h-72")
  })

  test("keeps visual styling out of inline style objects", () => {
    expect(source).not.toContain("const homeStyles")
    expect(source).not.toContain("style={homeStyles")
  })
})
