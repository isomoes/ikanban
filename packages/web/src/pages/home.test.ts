import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(join(import.meta.dir, "home.tsx"), "utf8")

describe("Home accessibility structure", () => {
  test("links the home icon to the GitHub repository", () => {
    expect(source).toContain('href="https://github.com/isomoes/ikanban"')
    expect(source).toContain('aria-label="iKanban on GitHub"')
    expect(source).toContain('target="_blank"')
    expect(source).toContain('rel="noreferrer"')
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

})
