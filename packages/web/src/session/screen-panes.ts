import { createEffect, createMemo, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { makeEventListener } from "@solid-primitives/event-listener"
import { debounce } from "@solid-primitives/scheduled"
import { createAnimatedPresence } from "@/runtime/animated-presence"
import type { SessionModel } from "@/session/model"
import type { SessionScreenLayout } from "./screen-layout"

export function createSessionScreenPanes(input: { session: SessionModel; screen: SessionScreenLayout }) {
  const { session, screen } = input
  const isDesktop = session.isDesktop
  const [store, setStore] = createStore({
    bottomTerminalCached: false,
    sideWidthMotion: false,
    timelineScrollbarHidden: false,
    sideHeightMotion: false,
    sideRegionPresent: false,
    sideReviewPresent: false,
    sideTerminalPresent: false,
    summaryResizeTranslate: undefined as string | undefined,
  })
  const [elements, setElements] = createStore<{
    chat?: HTMLDivElement
    side?: HTMLDivElement
    bottomTerminal?: HTMLDivElement
  }>({})
  const finishWindowResize = debounce(() => setStore("summaryResizeTranslate", undefined), 150)
  onMount(() => {
    makeEventListener(window, "resize", () => {
      if (store.summaryResizeTranslate === undefined) {
        const content = elements.chat?.querySelector("[data-timeline-virtual-content]")
        // Freeze the painted offset, including an in-flight slide, until resizing settles.
        setStore("summaryResizeTranslate", content ? getComputedStyle(content).translate : "none")
      }
      finishWindowResize()
    })
  })
  const sideVisible = createMemo(() => isDesktop() && screen.side.layout().visible)
  const sideTerminalVisible = createMemo(() => isDesktop() && screen.terminal.side() && screen.terminal.open())
  const bottomTerminalVisible = createMemo(() => isDesktop() && screen.terminal.open() && screen.terminal.bottom())
  const sidePresence = createAnimatedPresence(
    () => sideVisible() || undefined,
    () => elements.side ?? null,
    session.layout.tabKey,
  )
  const bottomTerminalPresence = createAnimatedPresence(
    () => bottomTerminalVisible() || undefined,
    () => elements.bottomTerminal ?? null,
    session.layout.tabKey,
  )
  const sideMotion = createMemo<{
    key?: string
    region: boolean
    terminal: boolean
    animateRegion: boolean
    animateTerminal: boolean
  }>((previous) => {
    const key = session.layout.tabKey()
    const region = screen.side.region.open()
    const terminal = sideTerminalVisible()
    const sameTab = previous?.key === key
    return {
      key,
      region,
      terminal,
      animateRegion: !!previous && sameTab && previous.region !== region,
      animateTerminal: !!previous && sameTab && previous.terminal !== terminal,
    }
  })
  const paneAnimating = () =>
    sidePresence.animate() ||
    sideMotion().animateRegion ||
    sideMotion().animateTerminal ||
    bottomTerminalPresence.animate()
  const trackSideWidthMotion = (event: TransitionEvent) => {
    if (event.currentTarget !== event.target || event.propertyName !== "width") return
    setStore("sideWidthMotion", event.type === "transitionrun")
  }
  const hideTimelineScrollbar = () => setStore("timelineScrollbarHidden", true)
  const revealTimelineScrollbar = (event: Event) => {
    if (!store.timelineScrollbarHidden || store.sideWidthMotion) return
    if (!(event.target instanceof Element) || !event.target.closest('[data-slot="session-timeline-scroll"]')) return
    setStore("timelineScrollbarHidden", false)
  }
  createEffect(() => {
    if (sideTerminalVisible()) setStore("sideTerminalPresent", true)
    if (bottomTerminalVisible()) setStore("bottomTerminalCached", true)
    if (!sideVisible()) setStore("sideHeightMotion", false)
  })
  createEffect(() => {
    if (!isDesktop() || screen.terminal.bottom()) setStore("sideTerminalPresent", false)
    if (isDesktop() && screen.terminal.side()) setStore("bottomTerminalCached", false)
  })
  createEffect(() => {
    if (screen.side.region.open()) setStore("sideRegionPresent", true)
    if (screen.review.panelOpen()) setStore("sideReviewPresent", true)
  })
  const mobileTerminalCached = createMemo((cached) => cached || (!isDesktop() && screen.terminal.open()), false)

  return {
    store,
    setStore,
    setElements,
    sideVisible,
    sideTerminalVisible,
    bottomTerminalVisible,
    sidePresence,
    bottomTerminalPresence,
    sideMotion,
    paneAnimating,
    trackSideWidthMotion,
    hideTimelineScrollbar,
    revealTimelineScrollbar,
    mobileTerminalCached,
  }
}
