import { expect, test, type BrowserContext, type Page } from "@playwright/test"
import { startBackend } from "./backend"

const connectScreen = (page: Page) => page.getByRole("heading", { name: "Connect to a server", exact: true })

async function guardNetwork(context: BrowserContext, baseURL: string, backend?: string, block = true) {
  const origin = new URL(baseURL).origin
  const unexpected: string[] = []
  const forbidden = (url: URL) =>
    (url.origin !== origin && url.origin !== backend) ||
    (url.origin === origin && /(?:^|\/)api(?:\/|$)/.test(url.pathname))
  context.on("request", (request) => {
    if (forbidden(new URL(request.url()))) unexpected.push(request.url())
  })
  // Cold-load tests block mistakes before they reach a real local backend.
  // The explicit fixture test observes only: enabling routing bypasses Chromium's
  // native CORS preflights, even when the particular request is not matched.
  if (block) await context.route(forbidden, (route) => route.abort("blockedbyclient"))
  return unexpected
}

test("first visit shows upstream connection form without an implicit backend", async ({ page, context, baseURL }) => {
  const unexpected = await guardNetwork(context, baseURL!)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const response = await page.goto("./")
  expect(response?.status()).toBe(200)
  await expect(connectScreen(page)).toBeVisible()
  await expect(page.getByLabel("Server address", { exact: true })).toHaveValue("")
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password")
  await expect(page.getByRole("button", { name: "Connect", exact: true })).toBeDisabled()
  await expect(page.getByText("opencode pair", { exact: true })).toBeVisible()
  await page.reload()
  await expect(connectScreen(page)).toBeVisible()
  expect(unexpected).toEqual([])
  expect(errors).toEqual([])
})

test("production assets and manifest resolve inside /ikanban/ with usable MIME types", async ({ page, request, baseURL }) => {
  const failures: string[] = []
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
  })
  await page.goto("./")
  await expect(connectScreen(page)).toBeVisible()
  const assets = await page.locator("script[src], link[href]").evaluateAll((nodes) => nodes.map((node) => ({
    url: node instanceof HTMLScriptElement ? node.src : (node as HTMLLinkElement).href,
    kind: node instanceof HTMLScriptElement ? "script" : (node as HTMLLinkElement).rel,
  })))
  expect(assets.some((asset) => asset.kind === "script")).toBe(true)
  expect(assets.some((asset) => asset.kind === "stylesheet")).toBe(true)
  for (const asset of assets) {
    expect(asset.url).toContain(baseURL!)
    const response = await request.get(asset.url)
    expect(response.status(), asset.url).toBe(200)
    const type = response.headers()["content-type"]
    if (asset.kind === "script" || asset.kind === "modulepreload") expect(type).toMatch(/(?:java|ecma)script/)
    if (asset.kind === "stylesheet") expect(type).toMatch(/text\/css/)
  }
  const manifestURL = assets.find((asset) => asset.kind === "manifest")?.url
  expect(manifestURL).toBeTruthy()
  const manifestResponse = await request.get(manifestURL!)
  expect(manifestResponse.headers()["content-type"]).toMatch(/application\/(?:manifest\+)?json/)
  const manifest = await manifestResponse.json()
  for (const key of ["id", "start_url", "scope"]) {
    expect(new URL(manifest[key], manifestURL).href).toBe(baseURL)
  }
  expect(manifest.icons.length).toBeGreaterThan(0)
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, manifestURL).href
    expect(url).toContain(baseURL!)
    const response = await request.get(url)
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toMatch(/^image\//)
  }
  for (const resource of await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name))) {
    expect(resource).toContain(baseURL!)
  }
  expect(failures).toEqual([])
})

test("cold deep link and reload receive real 404.html and preserve path, query, and hash", async ({ page, request, context, baseURL }) => {
  const unexpected = await guardNetwork(context, baseURL!)
  const fallback = await request.get("404.html")
  expect(fallback.status()).toBe(200)
  const serverKey = Buffer.from("https://pages-fixture.invalid").toString("base64url")
  for (const path of ["settings?tab=appearance&fixture=a%2Fb#pages-smoke", `server/${serverKey}/session/ses_pages?view=diff#message-1`]) {
    const target = new URL(path, baseURL).href
    const response = await page.goto(target)
    expect(response?.status()).toBe(404)
    expect(response?.headers()["content-type"]).toMatch(/text\/html/)
    expect(await response?.text()).toBe(await fallback.text())
    await expect(connectScreen(page)).toBeVisible()
    await expect(page).toHaveURL(target)
    const reloaded = await page.reload()
    expect(reloaded?.status()).toBe(404)
    await expect(connectScreen(page)).toBeVisible()
    await expect(page).toHaveURL(target)
  }
  expect(unexpected).toEqual([])
  for (const path of ["/api/info", "/ikanban/api/info", "/ikanban/_assets/missing.js", "/settings"]) {
    expect((await request.get(path)).status(), path).toBe(404)
  }
})

test("fixture smoke rejects bad Basic auth, connects explicitly, persists, and opens settings under base", async ({ page, context, baseURL }, testInfo) => {
  const backend = await startBackend(new URL(baseURL!).origin)
  const unexpected = await guardNetwork(context, baseURL!, backend.origin, false)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  try {
    await page.goto("./")
    await expect(connectScreen(page)).toBeVisible()
    expect(backend.requests).toEqual([])
    await page.getByLabel("Server address", { exact: true }).fill(backend.origin)
    await page.getByLabel("Password", { exact: true }).fill("incorrect-fixture-password")
    await page.getByRole("button", { name: "Connect", exact: true }).click()
    await expect(page.getByRole("alert")).toContainText("Could not connect")
    await expect(connectScreen(page)).toBeVisible()
    const rejected = backend.requests.filter((request) => request.method !== "OPTIONS")
    expect(rejected.length).toBeGreaterThan(0)
    expect(rejected.every((request) => request.path === "/api/info")).toBe(true)
    expect(rejected[0]?.authorization).toBe(`Basic ${Buffer.from("opencode:incorrect-fixture-password").toString("base64")}`)
    // A failed handshake must not add the server to persisted state.
    await page.reload()
    await expect(connectScreen(page)).toBeVisible()
    await expect(page.getByLabel("Server address", { exact: true })).toHaveValue("")
    const acceptedStart = backend.requests.length
    await page.getByLabel("Server address", { exact: true }).fill(`${backend.origin}/`)
    await page.getByLabel("Password", { exact: true }).fill(backend.password)
    await page.getByRole("button", { name: "Connect", exact: true }).click()
    await expect(connectScreen(page)).toHaveCount(0)
    await expect.poll(() => backend.requests.some((request) => request.path === "/api/project")).toBe(true)
    const beforeReload = backend.requests.length
    await page.reload()
    await expect.poll(() => backend.requests.slice(beforeReload).some((request) => request.path === "/api/event")).toBe(true)
    await expect(connectScreen(page)).toHaveCount(0)
    await page.getByRole("region", { name: "Recent sessions", exact: true }).waitFor()
    await page.keyboard.press("Control+,")
    await expect(page).toHaveURL(new URL("settings", baseURL).href)
    await expect(page.getByTestId("settings-screen")).toBeVisible()
    const reload = await page.reload()
    expect(reload?.status()).toBe(404)
    await expect(page.getByTestId("settings-screen")).toBeVisible()
    await expect(page).toHaveURL(new URL("settings", baseURL).href)
    const accepted = backend.requests.slice(acceptedStart).filter((request) => request.method !== "OPTIONS")
    expect(accepted.length).toBeGreaterThan(1)
    expect(accepted.every((request) => request.authorization === backend.authorization)).toBe(true)
    expect(accepted.every((request) => request.origin === new URL(baseURL!).origin)).toBe(true)
    expect(backend.requests.some((request) => request.method === "OPTIONS")).toBe(true)
    expect(backend.unexpected).toEqual([])
    expect(unexpected).toEqual([])
    expect(errors).toEqual([])
  } catch (error) {
    await testInfo.attach("fixture-page", { body: await page.screenshot(), contentType: "image/png" })
    await testInfo.attach("fixture-diagnostics", {
      contentType: "application/json",
      body: JSON.stringify({
        requests: backend.requests,
        unexpected: [...backend.unexpected, ...unexpected],
        errors,
        layout: await page.locator("#root, #root > div, main, [data-testid=settings-screen]").evaluateAll((nodes) => nodes.map((node) => {
          const style = getComputedStyle(node)
          const rect = node.getBoundingClientRect()
          return { tag: node.tagName, class: node.className, width: rect.width, height: rect.height, display: style.display, visibility: style.visibility }
        })),
      }, null, 2),
    })
    throw error
  } finally {
    await page.close()
    await backend.close()
  }
})

test.describe("production service worker", () => {
  test.use({ serviceWorkers: "allow" })

  test("activates only for /ikanban/ and supports a cached deep link", async ({ page, context, baseURL }) => {
    test.setTimeout(180_000)
    await page.goto("./")
    await expect(connectScreen(page)).toBeVisible()
    const registration = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready
      return { scope: ready.scope, script: ready.active?.scriptURL }
    })
    expect(registration).toEqual({ scope: baseURL, script: new URL("sw.js", baseURL).href })
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).map((item) => item.scope))).toEqual([baseURL])
    await page.reload()
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toBe(registration.script)
    await context.setOffline(true)
    const target = new URL("settings?fixture=offline#appearance", baseURL).href
    await page.goto(target)
    await expect(connectScreen(page)).toBeVisible()
    await expect(page).toHaveURL(target)
    await page.reload()
    await expect(connectScreen(page)).toBeVisible()
    await expect(page).toHaveURL(target)
  })
})
