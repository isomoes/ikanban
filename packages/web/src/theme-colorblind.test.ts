import { describe, expect, test } from "bun:test"
import { githubDarkColorblindTheme } from "../../ui/src/theme/default-themes"
import { contrastRatio } from "../../ui/src/theme/color"
import { resolveThemeVariant } from "../../ui/src/theme/resolve"
import { resolveThemeVariantV2 } from "../../ui/src/theme/v2/resolve"
import type { HexColor } from "../../ui/src/theme/types"

describe("GitHub Dark Colorblind rendering", () => {
  for (const mode of ["light", "dark"] as const) {
    test(`${mode} keeps readable V2 surfaces and historical diff colors`, () => {
      const variant = githubDarkColorblindTheme[mode]
      const dark = mode === "dark"
      const tokens = resolveThemeVariantV2(variant, dark)
      const color = (key: string): HexColor => {
        const value = tokens[key]!
        const ref = value.match(/^var\(--(.+)\)$/)
        return ref ? color(ref[1]!) : (value as HexColor)
      }
      const text = color("v2-text-text-base")
      expect(color("v2-background-bg-base")).toBe(dark ? "#0d1117" : "#ffffff")
      for (const surface of ["base", "deep", "layer-01", "layer-02"]) {
        expect(contrastRatio(text, color(`v2-background-bg-${surface}`))).toBeGreaterThan(4.5)
      }
      const diff = resolveThemeVariant(variant, dark)
      expect(diff["surface-diff-add-base"]).toBe(dark ? "#0d2748" : "#ddf4ff")
      expect(diff["surface-diff-delete-base"]).toBe(dark ? "#3a2312" : "#fff1e5")
    })
  }
})
