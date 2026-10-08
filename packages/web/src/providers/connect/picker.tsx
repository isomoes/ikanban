import { Icon } from "@ikanban/ui/icon"
import { ProviderIcon } from "@ikanban/ui/provider-icon"
import { Spinner } from "@ikanban/ui/spinner"
import { TextInput } from "@ikanban/ui/text-input"
import { createMemo, For, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/runtime/i18n/language"
import { useIntegrations } from "@/providers/catalog/integrations"

export const CUSTOM_ID = "_custom"

export function ProviderPicker(props: { directory?: string; onSelect: (provider: string) => void; onPrepare?: () => void }) {
  const integrations = useIntegrations(() => props.directory)
  const language = useLanguage()
  const [store, setStore] = createStore({
    filter: "",
    active: undefined as string | undefined,
    connecting: undefined as string | undefined,
  })
  const featured = ["opencode-go", "opencode", "anthropic", "openai", "google", "openrouter", "vercel"]
  const custom = () => ({ id: CUSTOM_ID, name: language.t("dialog.provider.custom.label") })
  const all = createMemo(() => {
    language.locale()
    const query = store.filter.trim().toLowerCase()
    const values = [custom(), ...integrations.list()]
    if (!query) return values
    return values.filter((provider) => `${provider.id} ${provider.name}`.toLowerCase().includes(query))
  })
  const popular = createMemo(() =>
    all()
      .filter((provider) => featured.includes(provider.id))
      .sort((a, b) => featured.indexOf(a.id) - featured.indexOf(b.id)),
  )
  const other = createMemo(() =>
    all()
      .filter((provider) => !featured.includes(provider.id))
      .sort((a, b) => {
        if (a.id === CUSTOM_ID) return -1
        if (b.id === CUSTOM_ID) return 1
        return a.name.localeCompare(b.name)
      }),
  )
  const rows = createMemo(() => [...popular(), ...other()])
  let picker: HTMLDivElement | undefined
  let search: HTMLInputElement | undefined

  onMount(() => search?.focus({ preventScroll: true }))

  const connect = (provider: string) => {
    props.onPrepare?.()
    props.onSelect(provider)
  }

  const move = (event: KeyboardEvent, direction: number) => {
    const items = rows()
    if (items.length === 0) return
    const index = items.findIndex((provider) => provider.id === store.active)
    const next = index < 0 ? (direction > 0 ? 0 : items.length - 1) : (index + direction + items.length) % items.length
    setStore("active", items[next].id)
    picker
      ?.querySelector<HTMLElement>(`[data-provider-id="${CSS.escape(items[next].id)}"]`)
      ?.focus({ preventScroll: true })
    event.preventDefault()
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") return move(event, 1)
    if (event.key === "ArrowUp") return move(event, -1)
    if (event.key !== "Enter" || !store.active) return
    connect(store.active)
    event.preventDefault()
  }

  return (
    <div ref={picker} class="flex min-h-0 flex-1 flex-col gap-4" onKeyDown={handleKeyDown}>
      <div class="shrink-0 px-1 pt-px">
        <TextInput
          ref={search}
          type="search"
          class="!w-full [font-family:var(--v2-font-family-sans)]"
          leadingIcon={<Icon name="magnifying-glass" size="small" />}
          placeholder={language.t("dialog.provider.search.placeholder")}
          value={store.filter}
          onInput={(event) => {
            setStore({ filter: event.currentTarget.value, active: undefined })
          }}
        />
      </div>
      <div class="relative min-h-0 flex-1">
        <div class="flex size-full min-h-0 flex-col gap-4 overflow-y-auto pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <For
            each={[
              { title: language.t("dialog.provider.group.popular"), items: popular },
              { title: language.t("dialog.provider.group.other"), items: other },
            ]}
          >
            {(group) => (
              <Show when={group.items().length > 0}>
                <section class="flex flex-col">
                  <div class="px-3 pb-2 text-[13px] font-[440] leading-text-compact tracking-[-0.04px] text-v2-text-text-muted">
                    {group.title}
                  </div>
                  <For each={group.items()}>
                    {(provider) => (
                      <button
                        type="button"
                        data-provider-id={provider.id}
                        class="flex min-h-9 w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-[13px] leading-text-compact tracking-[-0.04px] hover:bg-v2-overlay-simple-overlay-hover focus:bg-v2-overlay-simple-overlay-hover focus:outline-none"
                        classList={{ "bg-v2-overlay-simple-overlay-hover": store.active === provider.id }}
                        onMouseEnter={() => setStore("active", provider.id)}
                        disabled={store.connecting !== undefined}
                        aria-busy={store.connecting === provider.id}
                        onClick={() => connect(provider.id)}
                      >
                        <ProviderIcon id={provider.id} class="size-4 shrink-0 text-v2-icon-icon-base" />
                        <span class="min-w-0 truncate font-[530] text-v2-text-text-base">{provider.name}</span>
                        <Show when={provider.id === "opencode" || provider.id === "opencode-go"}>
                          <span class="min-w-0 truncate font-[440] text-v2-text-text-muted">
                            {language.t(
                              provider.id === "opencode"
                                ? "dialog.provider.opencode.tagline"
                                : "dialog.provider.opencodeGo.tagline",
                            )}
                          </span>
                          <span class="flex h-4 shrink-0 items-center rounded-xs border-[0.5px] border-v2-border-border-base bg-v2-background-bg-layer-03 px-1 text-[11px] font-[530] leading-none tracking-[0.05px] text-v2-text-text-muted">
                            {language.t("dialog.provider.tag.recommended")}
                          </span>
                        </Show>
                        <Show when={provider.id === CUSTOM_ID}>
                          <span class="flex h-4 shrink-0 items-center rounded-xs border-[0.5px] border-v2-border-border-base bg-v2-background-bg-layer-03 px-1 text-[11px] font-[530] leading-none tracking-[0.05px] text-v2-text-text-muted">
                            {language.t("settings.providers.tag.custom")}
                          </span>
                        </Show>
                        <Show when={store.connecting === provider.id}>
                          <Spinner class="ml-auto size-4 shrink-0 text-v2-icon-icon-muted" />
                        </Show>
                      </button>
                    )}
                  </For>
                </section>
              </Show>
            )}
          </For>
          <Show when={rows().length === 0}>
            <div class="flex h-24 items-center justify-center text-[13px] font-[440] text-v2-text-text-muted">
              {language.t("dialog.provider.empty")}
            </div>
          </Show>
        </div>
        <div
          class="pointer-events-none absolute inset-x-0 bottom-0 h-10"
          style={{ background: "linear-gradient(to bottom, transparent, var(--v2-background-bg-layer-01))" }}
        />
      </div>
    </div>
  )
}
