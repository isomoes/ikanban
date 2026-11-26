import { expect, test } from "bun:test"
import { externalArtifactURL, publishedArtifactFromTab, publishedArtifactLink, publishedArtifactTab } from "./artifact-link"

const path = "/api/experimental/artifacts/art_123abc"
const view = `${path}/view/reports/my%20report.html?mode=preview#top`

test("distinguishes published artifact references from workspace files", () => {
  expect(publishedArtifactLink(path)).toEqual({ id: "art_123abc", file: undefined })
  expect(publishedArtifactLink(view)).toEqual({ id: "art_123abc", file: "reports/my report.html" })
  expect(publishedArtifactLink("/workspace/report.html")).toBeUndefined()
  expect(publishedArtifactLink("/api/experimental/artifacts/providers")).toBeUndefined()
})

test("recognizes absolute artifact links only on the configured server and base path", () => {
  const server = "https://example.test/open-code"
  expect(publishedArtifactLink(`${server}${view}`, server)).toEqual(publishedArtifactLink(view))
  expect(publishedArtifactLink(`https://example.test${view}`, server)).toBeUndefined()
  expect(publishedArtifactLink(`https://other.test/open-code${view}`, server)).toBeUndefined()
})

test("only opens external artifact links over HTTP(S)", () => {
  const url = "https://preview.example.test/index.html"
  expect(externalArtifactURL(url)).toBe(url)
  expect(externalArtifactURL(path)).toBeUndefined()
  expect(externalArtifactURL("javascript:alert(1)")).toBeUndefined()
})

test("round trips published output tabs without treating them as file tabs", () => {
  const output = { id: "art_123abc", file: "reports/my report.html" }
  expect(publishedArtifactFromTab(publishedArtifactTab(output))).toEqual(output)
  expect(publishedArtifactFromTab(publishedArtifactTab({ id: output.id }))).toEqual({ id: output.id, file: undefined })
  expect(publishedArtifactFromTab("file://reports/my report.html")).toBeUndefined()
  expect(publishedArtifactFromTab("published-artifact:art_123abc/%invalid")).toBeUndefined()
})
