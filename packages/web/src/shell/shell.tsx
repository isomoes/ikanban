import { lazy, Show, Suspense, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { ResizeHandle } from "@ikanban/ui/resize-handle"
import { Titlebar } from "@/shell/titlebar/titlebar"
import { ToastRegion } from "@/shell/notifications/toast"
import { UploadToastHost } from "@/composer/attachments/uploads"
import { TitlebarRightProvider } from "@/shell/titlebar/right-slot"
import { useSettingsSurface } from "@/settings/surface"
import { useSettings } from "@/settings/model"
import { useCommand } from "@/shell/commands/command"
import { useLanguage } from "@/runtime/i18n/language"

const DebugBar = lazy(() => import("@/shell/debug/debug-bar").then((module) => ({ default: module.DebugBar })))

export default function Layout(props: ParentProps) {
  const settings = useSettingsSurface()
  const preferences = useSettings()
  const command = useCommand()
  const language = useLanguage()
  const mobile = createMediaQuery("(max-width: 767px)")
  const [state, setState] = createStore({
    debugTools: false,
    tabsWidth: 260,
    tabsMount: undefined as HTMLElement | undefined,
  })
  const verticalTabs = () => preferences.appearance.tabLayout() === "vertical" && !mobile()
  const bottomTitlebar = () => mobile() && preferences.general.mobileTitlebarPosition() === "bottom"

  // A plain object avoids the compiler's conditional-prop memo, which leaks when read from event handlers.
  const debugTools = {
    get visible() {
      return state.debugTools
    },
    toggle: () => setState("debugTools", (value) => !value),
  }

  command.register("debug-bar", () => [
    {
      id: "debugBar.toggle",
      title: language.t("command.debugBar.toggle"),
      category: language.t("command.category.view"),
      onSelect: debugTools.toggle,
    },
  ])

  return (
    <TitlebarRightProvider>
      <div
        class="relative bg-v2-background-bg-deep flex-1 min-h-0 min-w-0 flex flex-col select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable]]:select-text"
        style={{
          "--shell-top-inset": bottomTitlebar() ? "max(0px, calc(8px - env(safe-area-inset-top, 0px)))" : "8px",
          "--shell-bottom-inset": bottomTitlebar()
            ? "8px"
            : "max(0px, calc(8px - var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))))",
        }}
      >
        <Titlebar verticalTabs={verticalTabs() ? { mount: state.tabsMount } : undefined} />
        <div class="flex flex-1 min-h-0 min-w-0 flex-row">
          <Show when={verticalTabs()}>
            <aside
              ref={(element) => setState("tabsMount", element)}
              data-slot="vertical-tabs-sidebar"
              class="relative flex h-full min-h-0 shrink-0 flex-col bg-v2-background-bg-deep pe-0.5 ps-2.5 pb-[var(--shell-bottom-inset,8px)] pt-[var(--shell-top-inset,8px)]"
              style={{
                width: `${state.tabsWidth}px`,
                "padding-bottom": "max(10px, var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))",
              }}
            >
              <ResizeHandle
                class="-end-2"
                direction="horizontal"
                size={state.tabsWidth}
                min={140}
                max={520}
                onResize={(width) => setState("tabsWidth", width)}
              />
            </aside>
          </Show>
          {/* Size containment collapses percentage-height descendants in WebKit. */}
          <main
            class="flex-1 min-h-0 min-w-0 overflow-x-hidden flex flex-col items-start contain-content"
            style={{
              "padding-top": bottomTitlebar() ? "env(safe-area-inset-top, 0px)" : "0px",
              "padding-bottom":
                bottomTitlebar() || settings.active()
                  ? "0px"
                  : "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
              "--settings-bottom-inset": bottomTitlebar()
                ? "40px"
                : "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
              "--settings-top-inset": mobile() && !bottomTitlebar() ? "0px" : "var(--shell-top-inset, 8px)",
            }}
          >
            <Suspense>{props.children}</Suspense>
          </main>
        </div>
        <Show when={state.debugTools}>
          <Suspense>
            <DebugBar diagnostics={import.meta.env.DEV} inline />
          </Suspense>
        </Show>
        <ToastRegion />
        <UploadToastHost />
      </div>
    </TitlebarRightProvider>
  )
}
