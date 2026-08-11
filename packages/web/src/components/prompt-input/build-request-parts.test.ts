import { describe, expect, test } from "bun:test"
import type { SessionPromptInput } from "@opencode-ai/client"
import { buildRequestParts } from "./build-request-parts"

const build = (overrides: Partial<Parameters<typeof buildRequestParts>[0]> = {}) =>
  buildRequestParts({
    prompt: [{ type: "text", content: "hello", start: 0, end: 5 }],
    context: [],
    images: [],
    text: "hello",
    messageID: "msg_1",
    sessionID: "ses_1",
    sessionDirectory: "/repo",
    ...overrides,
  })

describe("buildRequestParts", () => {
  test("builds a typed native request and matching optimistic message", () => {
    const result = build({
      prompt: [
        { type: "text", content: "hello", start: 0, end: 5 },
        {
          type: "file",
          path: "src/foo.ts",
          content: "@src/foo.ts",
          start: 6,
          end: 17,
          selection: { startLine: 4, startChar: 1, endLine: 6, endChar: 1 },
        },
        { type: "agent", name: "planner", content: "@planner", start: 18, end: 26 },
      ],
      context: [{ key: "ctx:1", type: "file", path: "src/bar.ts", comment: "check this" }],
      images: [
        { type: "image", id: "img_1", filename: "a.png", mime: "image/png", dataUrl: "data:image/png;base64,AAA" },
      ],
      text: "hello @src/foo.ts @planner",
    })
    const request: Omit<SessionPromptInput, "sessionID"> = result.request

    expect(request).toEqual({
      id: "msg_1",
      text: [
        "hello @src/foo.ts @planner",
        "The user made the following comment regarding this file of src/bar.ts: check this",
      ].join("\n"),
      files: [
        {
          uri: "file:///repo/src/foo.ts?start=4&end=6",
          name: "foo.ts",
          mention: { start: 6, end: 17, text: "@src/foo.ts" },
        },
        { uri: "file:///repo/src/bar.ts", name: "bar.ts", mention: undefined },
        { uri: "data:image/png;base64,AAA", name: "a.png", mention: undefined },
      ],
      agents: [{ name: "planner", mention: { start: 18, end: 26, text: "@planner" } }],
    })
    expect(result.optimistic).toMatchObject({
      text: request.text,
      agents: request.agents,
      files: [
        {
          mime: "text/plain",
          name: "foo.ts",
          mention: { start: 6, end: 17, text: "@src/foo.ts" },
          source: { type: "uri", uri: "file:///repo/src/foo.ts?start=4&end=6" },
        },
        { mime: "text/plain", name: "bar.ts", source: { type: "uri", uri: "file:///repo/src/bar.ts" } },
        { data: "AAA", mime: "image/png", name: "a.png", source: { type: "inline" } },
      ],
    })
  })

  test("deduplicates uncommented context files but retains commented references", () => {
    const result = build({
      prompt: [{ type: "file", path: "src/foo.ts", content: "@src/foo.ts", start: 0, end: 11 }],
      context: [
        { key: "ctx:dup", type: "file", path: "src/foo.ts" },
        { key: "ctx:comment", type: "file", path: "src/foo.ts", comment: "focus here" },
      ],
      text: "@src/foo.ts",
    })

    expect(result.request.files?.map((file) => file.uri)).toEqual([
      "file:///repo/src/foo.ts",
      "file:///repo/src/foo.ts",
    ])
    expect(result.request.text).toBe(
      "@src/foo.ts\nThe user made the following comment regarding this file of src/foo.ts: focus here",
    )
    expect(result.optimistic.files).toHaveLength(2)
  })

  test("normalizes relative Windows paths into valid file URIs", () => {
    const result = build({
      prompt: [{ type: "file", path: "src\\foo.ts", content: "@src\\foo.ts", start: 0, end: 11 }],
      text: "@src\\foo.ts",
      sessionDirectory: "D:\\projects\\myapp",
    })
    const uri = result.request.files?.[0]?.uri

    expect(uri).toBe("file:///D:/projects/myapp/src/foo.ts")
    expect(() => new URL(uri!)).not.toThrow()
    expect(uri).not.toContain("%5C")
    expect(result.optimistic.files?.[0]?.source).toEqual({ type: "uri", uri })
  })

  test("encodes special characters in Windows file paths", () => {
    const result = build({
      prompt: [{ type: "file", path: "file#name.txt", content: "@file#name.txt", start: 0, end: 14 }],
      text: "@file#name.txt",
      sessionDirectory: "C:\\Users\\test\\Documents",
    })
    const uri = result.request.files?.[0]?.uri

    expect(uri).toBe("file:///C:/Users/test/Documents/file%23name.txt")
    expect(() => new URL(uri!)).not.toThrow()
  })

  test("builds Linux paths", () => {
    const result = build({
      prompt: [{ type: "file", path: "src/app.ts", content: "@src/app.ts", start: 0, end: 10 }],
      text: "@src/app.ts",
      sessionDirectory: "/home/user/project",
    })

    expect(result.request.files?.[0]?.uri).toBe("file:///home/user/project/src/app.ts")
  })

  test("builds macOS paths", () => {
    const result = build({
      prompt: [{ type: "file", path: "README.md", content: "@README.md", start: 0, end: 9 }],
      text: "@README.md",
      sessionDirectory: "/Users/kelvin/Projects/opencode",
    })

    expect(result.request.files?.[0]?.uri).toBe("file:///Users/kelvin/Projects/opencode/README.md")
  })

  test("normalizes context files with Windows paths", () => {
    const result = build({
      prompt: [],
      context: [
        { key: "ctx:1", type: "file", path: "src\\utils\\helper.ts" },
        { key: "ctx:2", type: "file", path: "test\\unit.test.ts", comment: "check tests" },
      ],
      text: "test",
      sessionDirectory: "D:\\workspace\\app",
    })
    const uris = result.request.files?.map((file) => file.uri)

    expect(uris).toEqual([
      "file:///D:/workspace/app/src/utils/helper.ts",
      "file:///D:/workspace/app/test/unit.test.ts",
    ])
    expect(uris?.every((uri) => !uri.includes("%5C") && URL.canParse(uri))).toBe(true)
    expect(result.request.text).toContain(
      "The user made the following comment regarding this file of test\\unit.test.ts: check tests",
    )
  })

  test("keeps manually specified absolute Windows paths absolute", () => {
    const result = build({
      prompt: [
        {
          type: "file",
          path: "D:\\other\\project\\file.ts",
          content: "@D:\\other\\project\\file.ts",
          start: 0,
          end: 25,
        },
      ],
      text: "@D:\\other\\project\\file.ts",
      sessionDirectory: "C:\\current\\project",
    })

    expect(result.request.files?.[0]?.uri).toBe("file:///D:/other/project/file.ts")
  })

  test("adds selection query parameters to Windows paths", () => {
    const result = build({
      prompt: [
        {
          type: "file",
          path: "src\\App.tsx",
          content: "@src\\App.tsx",
          start: 0,
          end: 12,
          selection: { startLine: 10, startChar: 0, endLine: 20, endChar: 5 },
        },
      ],
      text: "@src\\App.tsx",
      sessionDirectory: "C:\\project",
    })
    const uri = result.request.files?.[0]?.uri
    const url = new URL(uri!)

    expect(uri).toBe("file:///C:/project/src/App.tsx?start=10&end=20")
    expect(url.searchParams.get("start")).toBe("10")
    expect(url.searchParams.get("end")).toBe("20")
  })

  test("preserves dot segments in Windows paths for backend normalization", () => {
    const result = build({
      prompt: [
        {
          type: "file",
          path: "..\\..\\shared\\util.ts",
          content: "@..\\..\\shared\\util.ts",
          start: 0,
          end: 21,
        },
      ],
      text: "@..\\..\\shared\\util.ts",
      sessionDirectory: "C:\\projects\\myapp\\src",
    })
    const uri = result.request.files?.[0]?.uri

    expect(uri).toBe("file:///C:/projects/myapp/src/../../shared/util.ts")
    expect(() => new URL(uri!)).not.toThrow()
  })

  test("stores image data in native and optimistic attachments", () => {
    const result = build({
      images: [
        { type: "image", id: "img_1", filename: "a.png", mime: "image/png", dataUrl: "data:image/png;base64,YQ==" },
      ],
    })

    expect(result.request.files?.[0]).toEqual({
      uri: "data:image/png;base64,YQ==",
      name: "a.png",
      mention: undefined,
    })
    expect(result.optimistic.files?.[0]).toMatchObject({
      data: "YQ==",
      mime: "image/png",
      name: "a.png",
      source: { type: "inline" },
    })
  })
})
