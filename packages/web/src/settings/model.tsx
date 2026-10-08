import { reconcile, unwrap } from "solid-js/store"
import { createEffect, createMemo } from "solid-js"
import { createSimpleContext } from "@ikanban/ui/context"
import type { TimelineDetail } from "@ikanban/session-ui/timeline/detail"
import { persisted } from "@/runtime/persistence/storage"
import { ScopedKey, type ServerScope } from "@/runtime/server/scope"
import { monoFontFamily, sansFontFamily } from "./fonts"
import {
  defaultSettings,
  settingsPersistence,
  type FollowUpBehavior,
  type TabLayout,
  type TerminalPlacement,
  type WorkspaceDefaultDestination,
  type WorkspaceLastUsed,
} from "./schema"

export * from "./fonts"
export * from "./schema"

function withFallback<T>(read: () => T | undefined, fallback: T) {
  return createMemo(() => read() ?? fallback)
}

export const { use: useSettings, provider: SettingsProvider } = createSimpleContext({
  name: "Settings",
  gate: false,
  init: () => {
    const [store, setStore, , ready] = persisted({ key: "settings.v3" }, settingsPersistence, defaultSettings)
    const showFileTree = withFallback(() => store.general?.showFileTree, defaultSettings.general.showFileTree)
    const showSearch = withFallback(() => store.general?.showSearch, defaultSettings.general.showSearch)
    const showCustomAgents = withFallback(
      () => store.general?.showCustomAgents,
      defaultSettings.general.showCustomAgents,
    )
    createEffect(() => {
      if (typeof document === "undefined") return
      const root = document.documentElement
      const mono = monoFontFamily(store.appearance?.mono)
      root.style.setProperty("--font-family-mono", mono)
      root.style.setProperty("--font-family-sans", sansFontFamily(store.appearance?.sans))
      // Inline code can first appear during history backfill. Load its selected
      // face with the shell so that font discovery does not resize that mount.
      void document.fonts?.load(`440 13px ${mono}`).catch(() => undefined)
    })

    return {
      ready,
      get current() {
        return store
      },
      general: {
        autoSave: withFallback(() => store.general?.autoSave, defaultSettings.general.autoSave),
        setAutoSave(value: boolean) {
          setStore("general", "autoSave", value)
        },
        showFileTree,
        setShowFileTree(value: boolean) {
          setStore("general", "showFileTree", value)
        },
        showNavigation: withFallback(() => store.general?.showNavigation, defaultSettings.general.showNavigation),
        setShowNavigation(value: boolean) {
          setStore("general", "showNavigation", value)
        },
        showSearch,
        setShowSearch(value: boolean) {
          setStore("general", "showSearch", value)
        },
        showProjectIcon: withFallback(() => store.general?.showProjectIcon, defaultSettings.general.showProjectIcon),
        setShowProjectIcon(value: boolean) {
          setStore("general", "showProjectIcon", value)
        },
        showTerminal: withFallback(() => store.general?.showTerminal, defaultSettings.general.showTerminal),
        setShowTerminal(value: boolean) {
          setStore("general", "showTerminal", value)
        },
        timelineDetail: withFallback(() => store.general?.timelineDetail, defaultSettings.general.timelineDetail),
        setTimelineDetail(value: TimelineDetail) {
          setStore("general", "timelineDetail", structuredClone(unwrap(value)))
        },
        showCustomAgents,
        setShowCustomAgents(value: boolean) {
          setStore("general", "showCustomAgents", value)
        },
        mobileTitlebarPosition: withFallback(
          () => store.general?.mobileTitlebarPosition,
          defaultSettings.general.mobileTitlebarPosition,
        ),
        setMobileTitlebarPosition(value: "top" | "bottom") {
          setStore("general", "mobileTitlebarPosition", value)
        },
        mobileDiffWrap: withFallback(() => store.general?.mobileDiffWrap, defaultSettings.general.mobileDiffWrap),
        setMobileDiffWrap(value: boolean) {
          setStore("general", "mobileDiffWrap", value)
        },
        terminalPlacement: withFallback(
          () => store.general?.terminalPlacement,
          defaultSettings.general.terminalPlacement,
        ),
        setTerminalPlacement(value: TerminalPlacement) {
          setStore("general", "terminalPlacement", value)
        },
        followUpBehavior: withFallback(() => store.general?.followUpBehavior, defaultSettings.general.followUpBehavior),
        setFollowUpBehavior(value: FollowUpBehavior) {
          setStore("general", "followUpBehavior", value)
        },
      },
      sessionSummary: {
        projectExpanded: withFallback(
          () => store.sessionSummary?.projectExpanded,
          defaultSettings.sessionSummary.projectExpanded,
        ),
        serverExpanded: withFallback(
          () => store.sessionSummary?.serverExpanded,
          defaultSettings.sessionSummary.serverExpanded,
        ),
        setProjectExpanded(value: boolean) {
          setStore("sessionSummary", "projectExpanded", value)
        },
        setServerExpanded(value: boolean) {
          setStore("sessionSummary", "serverExpanded", value)
        },
      },
      visibility: {
        fileTree: showFileTree,
        search: showSearch,
        customAgents: showCustomAgents,
      },
      appearance: {
        fontSize: withFallback(() => store.appearance?.fontSize, defaultSettings.appearance.fontSize),
        setFontSize(value: number) {
          setStore("appearance", "fontSize", value)
        },
        font: withFallback(() => store.appearance?.mono, defaultSettings.appearance.mono),
        setFont(value: string) {
          setStore("appearance", "mono", value.trim() ? value : "")
        },
        uiFont: withFallback(() => store.appearance?.sans, defaultSettings.appearance.sans),
        setUIFont(value: string) {
          setStore("appearance", "sans", value.trim() ? value : "")
        },
        terminalFont: withFallback(() => store.appearance?.terminal, defaultSettings.appearance.terminal),
        setTerminalFont(value: string) {
          setStore("appearance", "terminal", value.trim() ? value : "")
        },
        tabLayout: withFallback(() => store.appearance?.tabLayout, defaultSettings.appearance.tabLayout),
        setTabLayout(value: TabLayout) {
          setStore("appearance", "tabLayout", value)
        },
        showProjectName: withFallback(
          () => store.appearance?.showProjectName,
          defaultSettings.appearance.showProjectName,
        ),
        setShowProjectName(value: boolean) {
          setStore("appearance", "showProjectName", value)
        },
      },
      keybinds: {
        get: (action: string) => store.keybinds?.[action],
        set(action: string, keybind: string) {
          setStore("keybinds", action, keybind)
        },
        reset(action: string) {
          setStore("keybinds", (current) => {
            if (!Object.prototype.hasOwnProperty.call(current, action)) return current
            const next = { ...current }
            delete next[action]
            return next
          })
        },
        resetAll() {
          setStore("keybinds", reconcile({}))
        },
      },
      permissions: {
        autoApprove: withFallback(() => store.permissions?.autoApprove, defaultSettings.permissions.autoApprove),
        setAutoApprove(value: boolean) {
          setStore("permissions", "autoApprove", value)
        },
      },
      workspaces: {
        defaultDestination: withFallback(
          () => store.workspaces?.defaultDestination,
          defaultSettings.workspaces.defaultDestination,
        ),
        setDefaultDestination(value: WorkspaceDefaultDestination) {
          setStore("workspaces", (current) => ({
            ...defaultSettings.workspaces,
            ...current,
            defaultDestination: value,
          }))
        },
        lastUsed(scope: ServerScope, projectID: string) {
          return store.workspaces?.lastUsed?.[ScopedKey.from(scope, projectID)]
        },
        setLastUsed(scope: ServerScope, projectID: string, value: WorkspaceLastUsed) {
          setStore("workspaces", (current) => ({
            ...defaultSettings.workspaces,
            ...current,
            lastUsed: { ...current?.lastUsed, [ScopedKey.from(scope, projectID)]: value },
          }))
        },
      },
      notifications: {
        agent: withFallback(() => store.notifications?.agent, defaultSettings.notifications.agent),
        setAgent(value: boolean) {
          setStore("notifications", "agent", value)
        },
        permissions: withFallback(() => store.notifications?.permissions, defaultSettings.notifications.permissions),
        setPermissions(value: boolean) {
          setStore("notifications", "permissions", value)
        },
        errors: withFallback(() => store.notifications?.errors, defaultSettings.notifications.errors),
        setErrors(value: boolean) {
          setStore("notifications", "errors", value)
        },
      },
      sounds: {
        agentEnabled: withFallback(() => store.sounds?.agentEnabled, defaultSettings.sounds.agentEnabled),
        setAgentEnabled(value: boolean) {
          setStore("sounds", "agentEnabled", value)
        },
        agent: withFallback(() => store.sounds?.agent, defaultSettings.sounds.agent),
        setAgent(value: string) {
          setStore("sounds", "agent", value)
        },
        permissionsEnabled: withFallback(
          () => store.sounds?.permissionsEnabled,
          defaultSettings.sounds.permissionsEnabled,
        ),
        setPermissionsEnabled(value: boolean) {
          setStore("sounds", "permissionsEnabled", value)
        },
        permissions: withFallback(() => store.sounds?.permissions, defaultSettings.sounds.permissions),
        setPermissions(value: string) {
          setStore("sounds", "permissions", value)
        },
        errorsEnabled: withFallback(() => store.sounds?.errorsEnabled, defaultSettings.sounds.errorsEnabled),
        setErrorsEnabled(value: boolean) {
          setStore("sounds", "errorsEnabled", value)
        },
        errors: withFallback(() => store.sounds?.errors, defaultSettings.sounds.errors),
        setErrors(value: string) {
          setStore("sounds", "errors", value)
        },
      },
    }
  },
})
