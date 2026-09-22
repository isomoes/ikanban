import { expect, test } from "bun:test"
import { MemoryRouter, Route, createMemoryHistory, useLocation, useNavigate, useParams } from "@solidjs/router"
import { createEffect } from "solid-js"
import { createComponent, render } from "solid-js/web"
import { appBase, appHref, stripBase } from "../src/shell/routes/base"
import { applyPath, backPath, forwardPath, type TitlebarHistory } from "../src/shell/titlebar/history"

test("base router handles deep links, session hashes, and titlebar history without duplicating the base", async () => {
  const host = document.createElement("div")
  const history = createMemoryHistory()
  const session = "/server/encoded/session/session-1"
  history.set({ value: appHref(`${session}?view=files#message-1`), replace: true, scroll: false })
  let location!: ReturnType<typeof useLocation>
  let navigate!: ReturnType<typeof useNavigate>
  let titlebar: TitlebarHistory = { stack: [], index: 0, action: undefined }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  const dispose = render(
    () =>
      createComponent(MemoryRouter, {
        history,
        base: appBase,
        root: (props) => {
          location = useLocation()
          navigate = useNavigate()
          createEffect(() => {
            titlebar = applyPath(titlebar, {
              url: `${stripBase(location.pathname)}${location.search}${location.hash}`,
              state: location.state,
            })
          })
          return props.children
        },
        get children() {
          return [
            createComponent(Route, { path: "/", component: () => "Home" }),
            createComponent(Route, { path: "/settings", component: () => "Settings" }),
            createComponent(Route, { path: "/new-session", component: () => "Draft" }),
            createComponent(Route, {
              path: "/server/:serverKey/session/:id",
              component: () => {
                const params = useParams()
                return `${params.serverKey}:${params.id}`
              },
            }),
          ]
        },
      }),
    host,
  )

  try {
    expect(host.textContent).toBe("encoded:session-1")
    expect(location.pathname).toBe(appHref(session))
    expect(location.hash).toBe("#message-1")

    // A deep link starts with a synthetic Home entry in the native titlebar.
    const back = backPath(titlebar)!
    titlebar = back.state
    navigate(back.to.url)
    await settle()
    expect(host.textContent).toBe("Home")
    expect(stripBase(location.pathname)).toBe("/")

    const forward = forwardPath(titlebar)!
    titlebar = forward.state
    navigate(forward.to.url)
    await settle()
    expect(location.pathname).toBe(appHref(session))
    expect(location.search).toBe("?view=files")
    expect(location.hash).toBe("#message-1")

    navigate(location.pathname + location.search + "#message-2", { resolve: false, replace: true })
    await settle()
    expect(location.pathname + location.search + location.hash).toBe(appHref(`${session}?view=files#message-2`))
    navigate(location.pathname + location.search, { resolve: false, replace: true })
    await settle()
    expect(location.pathname).toBe(appHref(session))
    expect(location.hash).toBe("")

    navigate("/new-session?draftId=a%2Fb")
    await settle()
    expect(host.textContent).toBe("Draft")
    expect(location.pathname).toBe(appHref("/new-session"))
    expect(location.query.draftId).toBe("a/b")
    navigate("/settings")
    await settle()
    expect(host.textContent).toBe("Settings")
    expect(location.pathname).toBe(appHref("/settings"))
  } finally {
    dispose()
  }
})
