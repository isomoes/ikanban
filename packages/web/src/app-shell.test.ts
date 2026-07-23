import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const appRoot = join(import.meta.dir, "..")
const appSource = readFileSync(join(import.meta.dir, "app.tsx"), "utf8")
const documentSource = readFileSync(join(appRoot, "index.html"), "utf8")
const layoutSource = readFileSync(join(import.meta.dir, "pages/layout.tsx"), "utf8")

describe("App shell accessibility", () => {
  test("provides a skip link and matching main content target", () => {
    expect(documentSource).toContain('href="#main-content"')
    expect(layoutSource).toContain('id="main-content"')
  })

  test("hides the skip link before application styles load", () => {
    const criticalStyle = documentSource.indexOf(".skip-link {")
    expect(criticalStyle).toBeGreaterThan(-1)
    expect(criticalStyle).toBeLessThan(documentSource.indexOf("</head>"))
    expect(documentSource.slice(criticalStyle, documentSource.indexOf("</style>", criticalStyle))).toContain(
      "transform: translateY(calc(-100% - 1rem))",
    )
  })

  test("announces route loading", () => {
    expect(appSource).toContain('role="status"')
    expect(appSource).toContain('data-component="route-loading"')
  })
})
