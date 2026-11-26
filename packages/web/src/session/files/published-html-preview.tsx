import { createMemo, createSignal, Index, onCleanup, onMount, Show } from "solid-js"

type HintTarget = { id: number; x: number; y: number; label: string; options?: string[]; selected?: number }

// The sandbox has an opaque origin. Let it report document height without giving
// either side DOM access to the other. If inline scripts are blocked, the frame
// keeps its normal viewport and native scrolling.
function previewBridge(filename: string, files: string[]) {
  const bundle = JSON.stringify({ filename, files }).replaceAll("<", "\\u003c")
  return `<script>(() => {
  const bundle = ${bundle};
  const base = new URL(bundle.filename.split("/").map(encodeURIComponent).join("/"), "https://bundle.invalid/");
  // Host-page hint extensions cannot enumerate controls inside an opaque frame.
  // Report small hit targets; activation still runs on the original element.
  const selector = 'a[href],button,select:not([multiple]),summary,input:not([type="hidden"]),textarea,[role="button"]';
  let targets = [], previousTargets = "", queued = false, activating;
  const updateTargets = () => {
    queued = false;
    targets = Array.from(document.querySelectorAll(selector)).filter(el =>
      !el.matches(":disabled") && !el.closest("[inert]") && el.getClientRects().length &&
      getComputedStyle(el).visibility === "visible").slice(0, 512);
    const hints = targets.flatMap((el, id) => {
      const r = el.getClientRects()[0];
      if (r.width < 8 || r.height < 8) return [];
      const x = r.left + r.width/2, y = r.top + r.height/2;
      const hit = document.elementFromPoint(x, y);
      if (!el.contains(hit)) return [];
      const label = (el.getAttribute("aria-label") || el.labels?.[0]?.textContent || el.textContent || el.title || el.tagName).trim().slice(0,160);
      return [{id, x, y, label, ...(el.tagName === "SELECT" ? {
        options: Array.from(el.options, o => o.label), selected: el.selectedIndex,
      } : {})}];
    });
    const signature = JSON.stringify(hints);
    if (signature === previousTargets) return;
    previousTargets = signature;
    parent.postMessage({type:"ikanban:artifact-hints", hints}, "*");
  };
  const schedule = () => {
    if (!queued) { queued = true; requestAnimationFrame(updateTargets); }
  };
  new MutationObserver(schedule).observe(document.documentElement, {subtree:true, childList:true, attributes:true, characterData:true});
  addEventListener("resize", schedule);
  addEventListener("scroll", schedule, true);
  addEventListener("change", schedule);
  addEventListener("load", schedule, true);
  schedule();
  addEventListener("message", event => {
    if (event.source !== parent || event.data?.type !== "ikanban:artifact-activate") return;
    const el = targets[event.data.id];
    if (!el?.isConnected || el.matches(":disabled")) return;
    if (el.tagName === "SELECT") {
      const index = event.data.option;
      if (!Number.isInteger(index) || !el.options[index] || el.options[index].disabled) return;
      el.selectedIndex = index;
      el.dispatchEvent(new Event("input", {bubbles:true}));
      el.dispatchEvent(new Event("change", {bubbles:true}));
    } else {
      activating = el;
      try {
        if (el.matches("input,textarea")) el.focus();
        el.click();
      } finally { activating = undefined; }
    }
    schedule();
  });
  addEventListener("click", (event) => {
    if ((!event.isTrusted && event.target !== activating) || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (anchor) {
      const href = anchor.getAttribute("href");
      if (!href || /^(?:#|\\/\\/|[a-z][a-z0-9+.-]*:)/i.test(href)) return;
      try {
        const url = new URL(href, base);
        if (url.origin !== base.origin) return;
        const file = decodeURIComponent(url.pathname.slice(1));
        if (!bundle.files.includes(file)) return;
        event.preventDefault();
        parent.postMessage({ type: "ikanban:artifact-file", file }, "*");
      } catch {}
      return;
    }
    if (target.closest("button,input,select,textarea,label,summary,video,audio,[role],[tabindex],[contenteditable],[onclick]") ||
        !getSelection()?.isCollapsed) return;
    parent.postMessage({ type: "ikanban:artifact-focus" }, "*");
  });
  let previous;
  const measure = () => {
    schedule();
    const root = document.documentElement;
    const height = Math.ceil(Math.max(root.getBoundingClientRect().height,
      root.scrollHeight > innerHeight ? root.scrollHeight : 0));
    if (height === previous) return;
    previous = height;
    parent.postMessage({ type: "ikanban:artifact-height", height }, "*");
  };
  const observer = new ResizeObserver(measure);
  observer.observe(document.documentElement);
  if (document.body) observer.observe(document.body);
  addEventListener("load", measure);
  measure();
 })();</script>`
}

export function PublishedHTMLPreview(props: { html: string; filename: string; files: string[]; onFile: (file: string) => void }) {
  let frame!: HTMLIFrameElement
  let viewport!: HTMLDivElement
  const [height, setHeight] = createSignal<number>()
  const [hints, setHints] = createSignal<HintTarget[]>([])
  const activate = (id: number, option?: number) =>
    frame.contentWindow?.postMessage({ type: "ikanban:artifact-activate", id, option }, "*")
  const src = createMemo(() => {
    const blob = new Blob([props.html, previewBridge(props.filename, props.files)], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    onCleanup(() => URL.revokeObjectURL(url))
    return url
  })
  onMount(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return
      if (event.data?.type === "ikanban:artifact-hints" && Array.isArray(event.data.hints)) {
        setHints(event.data.hints.slice(0, 512).filter((h: HintTarget) =>
          h && Number.isInteger(h.id) && Number.isFinite(h.x) && Number.isFinite(h.y) && typeof h.label === "string" &&
          (h.options === undefined || (Array.isArray(h.options) && h.options.every(o => typeof o === "string")))))
        return
      }
      if (event.data?.type === "ikanban:artifact-file" && props.files.includes(event.data.file)) {
        props.onFile(event.data.file)
        return
      }
      if (event.data?.type === "ikanban:artifact-focus" && document.activeElement === frame) {
        viewport.focus({ preventScroll: true })
        return
      }
      if (event.data?.type !== "ikanban:artifact-height") return
      const value = event.data.height
      if (Number.isSafeInteger(value) && value > 0) setHeight(Math.min(value, 100_000))
    }
    window.addEventListener("message", receive)
    onCleanup(() => window.removeEventListener("message", receive))
  })
  return (
    <div ref={viewport} data-slot="artifact-scroll-viewport" role="region" aria-label={props.filename} tabIndex={0}
      class="min-h-0 flex-1 overflow-auto overscroll-contain bg-white">
      <div class="relative isolate min-h-full overflow-clip" style={{ height: height() ? `${height()}px` : "100%" }}>
        <iframe ref={frame} title={props.filename} src={src()} sandbox="allow-scripts" referrerPolicy="no-referrer"
          class="block h-full w-full border-0" />
        <Index each={hints()}>{(hint) => {
          const style = () => ({ left: `${hint().x}px`, top: `${hint().y}px` })
          const classes = "absolute size-3 -translate-x-1/2 -translate-y-1/2 cursor-pointer appearance-none border-0 !bg-transparent p-0 text-transparent"
          return (
            <Show when={hint().options} fallback={
              <button type="button" data-artifact-hint="" tabIndex={-1} aria-label={hint().label} class={classes}
                style={style()} onClick={() => activate(hint().id)} />
            }>
              {(options) => (
                <select data-artifact-hint="" tabIndex={-1} aria-label={hint().label} class={classes} style={style()}
                  value={String(hint().selected)} onChange={e => activate(hint().id, Number(e.currentTarget.value))}>
                  <Index each={options()}>{(label, i) => <option class="text-black" value={i} selected={i === hint().selected}>{label()}</option>}</Index>
                </select>
              )}
            </Show>
          )
        }}</Index>
      </div>
    </div>
  )
}
