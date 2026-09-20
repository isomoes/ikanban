import { describe, expect, test } from "bun:test"

const settingsFiles = ["settings-general.tsx", "settings-keybinds.tsx", "settings-models.tsx", "settings-providers.tsx"]
const settingsSources = await Promise.all(
  settingsFiles.map(async (file) => ({ file, source: await Bun.file(new URL(file, import.meta.url)).text() })),
)
const dialogSource = await Bun.file(new URL("dialog-settings.tsx", import.meta.url)).text()
const stylesheet = Bun.file(new URL("settings-cockpit.css", import.meta.url))
const styles = (await stylesheet.exists()) ? await stylesheet.text() : ""

describe("settings structure", () => {
  test("uses one settings page structure", () => {
    for (const { file, source } of settingsSources) {
      expect(source, file).toContain('data-component="settings-page"')
      expect(source, file).toContain('data-component="settings-header"')
      expect(source, file).toContain('data-component="settings-section"')
      expect(source, file).toContain('data-component="settings-row"')
    }
  })

  test("loads compact shared settings styles", () => {
    expect(dialogSource).toContain('import "./settings-cockpit.css"')
    expect(dialogSource).toContain('data-component="settings-dialog"')
    expect(styles).toContain('[data-component="settings-page"]')
    expect(styles).toContain('[data-component="settings-header"]')
    expect(styles).toContain('[data-component="settings-section"]')
    expect(styles).toContain('[data-component="settings-row"]')
    expect(styles).toContain(":focus-visible")
    expect(styles).toContain("[data-selected]")
  })

  test("collapses settings navigation above content on narrow screens", () => {
    expect(dialogSource).toContain('data-slot="settings-nav"')
    expect(styles).toContain("flex-direction: column")
    expect(styles).toContain('[data-slot="settings-nav-footer"]')
  })
})
