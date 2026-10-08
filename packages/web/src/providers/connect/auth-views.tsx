import { Button } from "@ikanban/ui/button"
import { Icon } from "@ikanban/ui/icon"
import { List } from "@ikanban/ui/list"
import { Spinner } from "@ikanban/ui/spinner"
import { TextField } from "@ikanban/ui/text-field"
import { TextInput } from "@ikanban/ui/text-input"
import { createMemo, createUniqueId, For, Match, onMount, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { ExternalLink } from "@/runtime/platform/external-link"
import { useLanguage } from "@/runtime/i18n/language"
import type { ProviderConnectionController, ProviderConnectMethod } from "./controller"
import { methodDetails } from "./method"

type IntegrationForm = NonNullable<ProviderConnectMethod["form"]>[number]
type StringForm = Extract<IntegrationForm, { type: "string" }>

export type AuthViewProps = {
  controller: ProviderConnectionController
  provider: () => { id: string; name: string }
}


export function AuthFormView(props: AuthViewProps) {
  const language = useLanguage()
  const { controller, provider } = props
  const [formStore, setFormStore] = createStore({
    value: {} as Record<string, string>,
    index: 0,
  })

  const fields = createMemo<StringForm[]>(() => {
    const value = controller.currentMethod()
    return (value?.form ?? []).flatMap((field) => (field.type === "string" ? [field] : []))
  })
  const matches = (field: StringForm, value: Record<string, string>) => {
    return (field.when ?? []).every((condition) => {
      const actual = value[condition.key]
      if (actual === undefined) return false
      return condition.op === "eq" ? actual === condition.value : actual !== condition.value
    })
  }
  const current = createMemo(() => {
    const all = fields()
    const index = all.findIndex((field, index) => index >= formStore.index && matches(field, formStore.value))
    if (index === -1) return undefined
    return {
      index,
      field: all[index],
    }
  })
  const valid = createMemo(() => {
    const item = current()
    if (!item || item.field.options) return false
    if (!item.field.required) return true
    return (formStore.value[item.field.key] ?? "").trim().length > 0
  })

  async function next(index: number, value: Record<string, string>) {
    const selected = controller.methodIndex()
    if (selected === undefined) return
    const next = fields().findIndex((field, i) => i > index && matches(field, value))
    if (next !== -1) {
      setFormStore("index", next)
      return
    }
    await controller.auth.select(selected, value)
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const item = current()
    if (!item || item.field.options) return
    if (!valid()) return
    await next(item.index, formStore.value)
  }

  const item = () => current()
  const text = createMemo(() => {
    const field = item()?.field
    if (!field || field.options) return undefined
    return field
  })
  const select = createMemo(() => {
    const field = item()?.field
    if (!field?.options) return undefined
    return field
  })

  return (
    <form onSubmit={handleSubmit} class="flex flex-col items-start gap-4">
      <Switch>
        <Match when={item()?.field.options === undefined}>
          <TextField
            type="text"
            label={text()?.title ?? ""}
            placeholder={text()?.placeholder}
            value={text() ? (formStore.value[text()!.key] ?? "") : ""}
            onChange={(value) => {
              const field = text()
              if (!field) return
              setFormStore("value", field.key, value)
            }}
          />
          <Button class="w-auto" type="submit" size="large" variant="contrast" disabled={!valid()}>
            {language.t("common.continue")}
          </Button>
        </Match>
        <Match when={item()?.field.options !== undefined}>
          <div class="w-full flex flex-col gap-1.5">
            <div class="text-14-regular text-text-base">{select()?.title}</div>
            <div>
              <List
                class="px-3"
                items={select()?.options ?? []}
                key={(x) => x.value}
                current={select()?.options?.find((x) => x.value === formStore.value[select()!.key])}
                onSelect={(value) => {
                  if (!value) return
                  const field = select()
                  if (!field) return
                  const nextValue = {
                    ...formStore.value,
                    [field.key]: value.value,
                  }
                  setFormStore("value", field.key, value.value)
                  void next(item()!.index, nextValue)
                }}
              >
                {(option) => (
                  <div class="w-full flex items-center gap-x-2">
                    <div class="w-4 h-2 rounded-[1px] bg-input-base shadow-xs-border-base flex items-center justify-center">
                      <div class="w-2.5 h-0.5 ml-0 bg-icon-strong-base hidden" data-slot="list-item-extra-icon" />
                    </div>
                    <span>{option.label}</span>
                    <span class="text-14-regular text-text-weak">{option.description}</span>
                  </div>
                )}
              </List>
            </div>
          </div>
        </Match>
      </Switch>
    </form>
  )
}

export function MethodSelection(props: AuthViewProps) {
  const language = useLanguage()
  const { controller, provider } = props
  return (
    <div class="flex flex-col gap-2">
      <div class="px-3 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted">
        {language.t("provider.connect.selectMethod", { provider: provider().name })}
      </div>
      <div class="flex flex-col">
        <For each={controller.methods()}>
          {(item, index) => {
            const details = () => methodDetails(item, language.t)
            return (
              <button
                type="button"
                class="group flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-[13px] leading-5 tracking-[-0.04px] hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
                onClick={() => void controller.auth.select(index())}
              >
                <span class="flex h-2 w-4 shrink-0 items-center justify-center rounded-[1px] bg-v2-background-bg-base shadow-[var(--v2-elevation-button-neutral)]">
                  <span class="hidden h-0.5 w-2.5 bg-v2-icon-icon-base group-hover:block group-focus-visible:block" />
                </span>
                <span class="font-[530] text-v2-text-text-base">{details().label}</span>
                <Show when={details().hint}>
                  {(hint) => <span class="font-[440] text-v2-text-text-muted">{hint()}</span>}
                </Show>
              </button>
            )
          }}
        </For>
      </div>
    </div>
  )
}

export function ApiAuthView(props: AuthViewProps) {
  const language = useLanguage()
  const { controller, provider } = props
  let apiKey: HTMLInputElement | undefined
  const errorID = createUniqueId()
  const [formStore, setFormStore] = createStore({
    value: "",
    error: undefined as string | undefined,
  })

  onMount(() => {
    apiKey?.focus({ preventScroll: true })
  })

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()

    if (!(e.currentTarget instanceof HTMLFormElement)) return
    const value = new FormData(e.currentTarget).get("apiKey")
    const apiKey = typeof value === "string" ? value : ""

    if (!apiKey?.trim()) {
      setFormStore("error", language.t("provider.connect.apiKey.required"))
      return
    }

    setFormStore("error", undefined)
    await controller.auth.connectKey(apiKey)
  }

  return (
    <div class="flex flex-col gap-5 px-3 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted">
      <Show
        when={provider().id === "opencode"}
        fallback={language.t("provider.connect.apiKey.description", { provider: provider().name })}
      >
        <div class="flex flex-col gap-5">
          <div>{language.t("provider.connect.opencodeZen.line1")}</div>
          <div>{language.t("provider.connect.opencodeZen.line2")}</div>
          <div>
            {language.t("provider.connect.opencodeZen.visit.prefix")}
            <ExternalLink
              href="https://opencode.ai/zen"
              class="text-v2-text-text-base focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-v2-border-border-focus"
            >
              {language.t("provider.connect.opencodeZen.visit.link")}
            </ExternalLink>
            {language.t("provider.connect.opencodeZen.visit.suffix")}
          </div>
        </div>
      </Show>
      <form onSubmit={handleSubmit} class="flex flex-col items-start gap-5 self-stretch">
        <label class="flex w-full flex-col gap-1 font-[530] leading-4 text-v2-text-text-base">
          {language.t("provider.connect.apiKey.label", { provider: provider().name })}
          <TextInput
            ref={apiKey}
            class="!w-full"
            name="apiKey"
            data-input="provider-api-key"
            placeholder={language.t("provider.connect.apiKey.placeholder")}
            value={formStore.value}
            invalid={formStore.error !== undefined}
            aria-describedby={formStore.error ? errorID : undefined}
            autocomplete="off"
            spellcheck={false}
            onInput={(event) => setFormStore("value", event.currentTarget.value)}
          />
        </label>
        <Show when={formStore.error}>
          {(error) => (
            <div id={errorID} role="alert" class="-mt-4 text-xs text-v2-state-fg-danger">
              {error()}
            </div>
          )}
        </Show>
        <Button type="submit" variant="contrast" data-action="provider-connect-submit">
          {language.t("common.continue")}
        </Button>
      </form>
    </div>
  )
}

export function OAuthCodeView(props: AuthViewProps) {
  const language = useLanguage()
  const { controller, provider } = props
  let codeInput: HTMLInputElement | undefined
  const errorID = createUniqueId()
  const [formStore, setFormStore] = createStore({
    value: "",
    error: undefined as string | undefined,
  })

  onMount(() => {
    codeInput?.focus({ preventScroll: true })
  })

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()

    if (!(e.currentTarget instanceof HTMLFormElement)) return
    const value = new FormData(e.currentTarget).get("code")
    const code = typeof value === "string" ? value : ""

    if (!code?.trim()) {
      setFormStore("error", language.t("provider.connect.oauth.code.required"))
      return
    }

    setFormStore("error", undefined)
    setFormStore("error", await controller.auth.completeCode(code))
  }

  return (
    <div class="flex flex-col gap-5 px-3 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-muted">
      <div>
        {language.t("provider.connect.oauth.code.visit.prefix")}
        <ExternalLink href={controller.authorization()!.url} class="text-v2-text-text-base">
          {language.t("provider.connect.oauth.code.visit.link")}
        </ExternalLink>
        {language.t("provider.connect.oauth.code.visit.suffix", { provider: provider().name })}
      </div>
      <form onSubmit={handleSubmit} class="flex flex-col items-start gap-5 self-stretch">
        <label class="flex w-full flex-col gap-1 font-[530] leading-4 text-v2-text-text-base">
          {language.t("provider.connect.oauth.code.label", { method: controller.currentMethod()?.label ?? "" })}
          <TextInput
            ref={codeInput}
            class="!w-full"
            name="code"
            placeholder={language.t("provider.connect.oauth.code.placeholder")}
            value={formStore.value}
            invalid={formStore.error !== undefined}
            aria-describedby={formStore.error ? errorID : undefined}
            autocomplete="off"
            spellcheck={false}
            onInput={(event) => setFormStore("value", event.currentTarget.value)}
          />
        </label>
        <Show when={formStore.error}>
          {(error) => (
            <div id={errorID} role="alert" class="-mt-4 text-xs text-v2-state-fg-danger">
              {error()}
            </div>
          )}
        </Show>
        <Button type="submit" variant="contrast">
          {language.t("common.continue")}
        </Button>
      </form>
    </div>
  )
}

export function OAuthAutoView(props: AuthViewProps) {
  const language = useLanguage()
  const { controller, provider } = props
  const code = createMemo(() => {
    const instructions = controller.authorization()?.instructions
    if (instructions?.includes(":")) {
      return instructions.split(":").pop()?.trim()
    }
    return instructions
  })

  return (
    <div class="flex flex-col gap-6">
      <div class="text-14-regular text-text-base">
        {language.t("provider.connect.oauth.auto.visit.prefix")}
        <ExternalLink href={controller.authorization()!.url}>
          {language.t("provider.connect.oauth.auto.visit.link")}
        </ExternalLink>
        {language.t("provider.connect.oauth.auto.visit.suffix", { provider: provider().name })}
      </div>
      <TextField
        label={language.t("provider.connect.oauth.auto.confirmationCode")}
        class="font-mono"
        value={code()}
        readOnly
        copyable
      />
      <div class="text-14-regular text-text-base flex items-center gap-4">
        <Spinner />
        <span>{language.t("provider.connect.status.waiting")}</span>
      </div>
    </div>
  )
}
