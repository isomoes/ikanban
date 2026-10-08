import { createStore } from "solid-js/store"
import type { Accessor } from "solid-js"
import { useLanguage } from "@/runtime/i18n/language"
import { pathKey } from "@/workspaces/path-key"
import { searchProjects } from "@/workspaces/project-search"
import { handleDocumentSearchKeydown } from "@/shell/commands/search-keydown"

export type PromptProject = {
  name?: string
  id?: string
  worktree: string
  sandboxes?: string[]
  icon?: { color?: string; url?: string; override?: string }
  server?: { key: string; name: string }
}

export type PromptProjectControls = {
  available: PromptProject[]
  directory: string
  server?: string
  select: (worktree: string, server?: string) => void
  add: (title: string, server?: string) => void
}

const actionPrefix = "action:"
const projectPrefix = "project:"

export function projectKey(project: PromptProject) {
  return `${projectPrefix}${encodeURIComponent(project.server?.key ?? "")}:${encodeURIComponent(project.worktree)}`
}

export function actionKey(server?: string) {
  return `${actionPrefix}${encodeURIComponent(server ?? "")}`
}

export function createPromptProjectController(input: {
  controls: Accessor<PromptProjectControls>
  onDone: () => void
}) {
  const language = useLanguage()
  const [store, setStore] = createStore({ open: false, search: "", active: "" })
  let searchRef: HTMLInputElement | undefined

  const current = () => {
    const key = pathKey(input.controls().directory)
    return input
      .controls()
      .available.find(
        (project) =>
          (!project.server || project.server.key === input.controls().server) &&
          (pathKey(project.worktree) === key || project.sandboxes?.some((sandbox) => pathKey(sandbox) === key)),
      )
  }
  const selected = () => current() ?? input.controls().available[0]
  const projects = () => searchProjects(input.controls().available, store.search)
  const servers = () =>
    input
      .controls()
      .available.map((project) => project.server)
      .filter((server, index, all) => server && all.findIndex((item) => item?.key === server.key) === index)
  const keys = () => {
    if (servers().length <= 1) {
      return [...projects().map(projectKey), actionKey(servers()[0]?.key)]
    }
    return [
      ...servers().flatMap((server) =>
        projects()
          .filter((project) => project.server?.key === server!.key)
          .map(projectKey),
      ),
      actionKey(),
    ]
  }
  const initialActive = () => {
    const selectedKey = selected() ? projectKey(selected()!) : undefined
    const options = keys()
    if (selectedKey && options.includes(selectedKey)) return selectedKey
    return options[0] ?? ""
  }
  const close = () => {
    setStore({ open: false, search: "", active: "" })
    input.onDone()
  }
  const select = (project: PromptProject) => {
    if (
      pathKey(project.worktree) !== pathKey(current()?.worktree ?? "") ||
      project.server?.key !== current()?.server?.key
    ) {
      input.controls().select(project.worktree, project.server?.key)
    }
    close()
  }
  const add = (server?: string) => {
    setStore({ open: false, search: "", active: "" })
    input.controls().add(language.t("command.project.open"), server)
  }
  const setSearch = (value: string) => {
    const first = searchProjects(input.controls().available, value)[0]
    setStore({
      search: value,
      active: first ? projectKey(first) : actionKey(servers().length > 1 ? undefined : servers()[0]?.key),
    })
  }

  return {
    selected,
    empty: () => input.controls().available.length === 0,
    projects,
    servers,
    projectKey,
    actionKey,
    open: () => store.open,
    search: () => store.search,
    active: () => store.active,
    labels: {
      add: () => language.t("session.new.project.add"),
      clear: () => language.t("common.clear"),
      new: () => language.t("session.new.project.new"),
      search: () => language.t("session.new.project.search"),
    },
    add,
    select,
    setOpen(open: boolean) {
      if (open) {
        setStore({ open: true, active: initialActive() })
        setTimeout(() => requestAnimationFrame(() => searchRef?.focus()))
        return
      }
      setStore({ open: false, search: "", active: "" })
    },
    setSearch,
    clearSearch() {
      setStore({ search: "", active: initialActive() })
      setTimeout(() => searchRef?.focus())
    },
    setActive(key: string) {
      setStore("active", key)
    },
    moveActive(delta: number) {
      const options = keys()
      if (options.length === 0) return
      const index = options.indexOf(store.active)
      const start = index === -1 ? 0 : index
      setStore("active", options[(start + delta + options.length) % options.length])
    },
    activeProject() {
      return store.active.startsWith(projectPrefix)
        ? projects().find((project) => projectKey(project) === store.active)
        : undefined
    },
    activeServer() {
      return store.active.startsWith(actionPrefix)
        ? decodeURIComponent(store.active.slice(actionPrefix.length)) || undefined
        : undefined
    },
    activeAction() {
      return store.active.startsWith(actionPrefix)
    },
    setSearchRef(el: HTMLInputElement) {
      searchRef = el
    },
    focusSearch() {
      setTimeout(() => requestAnimationFrame(() => searchRef?.focus()))
    },
    handleSearchKeydown(event: KeyboardEvent) {
      return handleDocumentSearchKeydown(searchRef, event, store.search, setSearch)
    },
  }
}

export type PromptProjectController = ReturnType<typeof createPromptProjectController>
