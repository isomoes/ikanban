import { afterEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createStaticHandler } from "./static"

const directories: string[] = []

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), "ikanban-static-"))
  const root = join(parent, "dist")
  directories.push(parent)
  await mkdir(root)
  await Bun.write(join(root, "index.html"), "<main>iKanban</main>")
  await Bun.write(join(root, "app-a1b2c3.js"), "console.log('ikanban')")
  return root
}

function request(path: string) {
  return new Request(`http://localhost${path}`)
}

describe("static handler", () => {
  test("redirects the bare base path", async () => {
    const handler = createStaticHandler({ root: await fixture() })

    const response = await handler(request("/ikanban?project=one"))

    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe("/ikanban/?project=one")
  })

  test("serves hashed assets with their MIME type", async () => {
    const handler = createStaticHandler({ root: await fixture() })

    const response = await handler(request("/ikanban/app-a1b2c3.js"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/javascript")
    expect(await response.text()).toBe("console.log('ikanban')")
  })

  test("falls back to the SPA document below the base path", async () => {
    const handler = createStaticHandler({ root: await fixture() })

    const response = await handler(request("/ikanban/project/session"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(await response.text()).toBe("<main>iKanban</main>")
  })

  test("gives API routes precedence over the SPA fallback", async () => {
    const root = await fixture()
    const handler = createStaticHandler({
      root,
      api: (incoming) => new URL(incoming.url).pathname === "/ikanban/session"
        ? Response.json({ source: "api" })
        : undefined,
    })

    const response = await handler(request("/ikanban/session"))

    expect(await response.json()).toEqual({ source: "api" })
  })

  test("rejects encoded traversal instead of reading outside the static root", async () => {
    const root = await fixture()
    await writeFile(join(root, "..", "secret.txt"), "secret")
    const handler = createStaticHandler({ root })

    const response = await handler(request("/ikanban/%2e%2e%2fsecret.txt"))

    expect(response.status).toBe(404)
    expect(await response.text()).not.toContain("secret")
  })

  test("returns 404 outside the base path", async () => {
    const handler = createStaticHandler({ root: await fixture() })

    const response = await handler(request("/other"))

    expect(response.status).toBe(404)
  })
})
