import { useDialog } from "@ikanban/ui/context/dialog"
import { Icon } from "@ikanban/ui/icon"
import { ProviderIcon } from "@ikanban/ui/provider-icon"
import { Spinner } from "@ikanban/ui/spinner"
import { createMemo, Match, Switch } from "solid-js"
import { useParams } from "@solidjs/router"
import { showToast } from "@/shell/notifications/toast"
import { useLanguage } from "@/runtime/i18n/language"
import { useProviders } from "@/providers/catalog/providers"
import { decode64 } from "@/runtime/persistence/base64"
import { ApiAuthView, AuthFormView, MethodSelection, OAuthAutoView, OAuthCodeView } from "./auth-views"
import { createProviderConnectionController } from "./controller"

export function ProviderConnection(props: {
  provider: string
  directory?: string
  onBack: () => void
  setBack: (handler: () => void) => void
}) {
  const dialog = useDialog()
  const params = useParams()
  const language = useLanguage()
  const providers = useProviders(() => props.directory)
  const directory = () => props.directory ?? decode64(params.dir)

  const controller = createProviderConnectionController({
    provider: () => props.provider,
    directory,
    onComplete: () => {
      dialog.close()
      showToast({
        variant: "success",
        icon: "circle-check",
        title: language.t("provider.connect.toast.connected.title", { provider: provider().name }),
        description: language.t("provider.connect.toast.connected.description", { provider: provider().name }),
      })
    },
  })
  const provider = createMemo(() => ({
    id: props.provider,
    name: providers.all().get(props.provider)?.name ?? controller.integration()?.name ?? props.provider,
  }))

  function goBack() {
    if (controller.methods().length > 1 && controller.methodIndex() !== undefined) {
      controller.auth.reset()
      return
    }
    props.onBack()
  }

  props.setBack(goBack)

  return (
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex h-10 shrink-0 items-start gap-2 px-3">
        <ProviderIcon id={props.provider} class="mt-0.5 size-4 shrink-0 text-v2-icon-icon-base" />
        <div class="text-[15px] font-[530] leading-5 tracking-[-0.13px] text-v2-text-text-base">
          <Switch>
            <Match
              when={props.provider === "anthropic" && controller.currentMethod()?.label?.toLowerCase().includes("max")}
            >
              {language.t("provider.connect.title.anthropicProMax")}
            </Match>
            <Match when={true}>{language.t("provider.connect.title", { provider: provider().name })}</Match>
          </Switch>
        </div>
      </div>
      <div class="flex min-h-0 flex-1 flex-col">
        <div>
          <Switch>
            <Match when={controller.loading()}>
              <div class="text-14-regular text-text-base">
                <div class="flex items-center gap-x-2">
                  <Spinner />
                  <span>{language.t("provider.connect.status.inProgress")}</span>
                </div>
              </div>
            </Match>
            <Match when={controller.methodIndex() === undefined}>
              <MethodSelection controller={controller} provider={provider} />
            </Match>
            <Match when={controller.auth.state() === "pending"}>
              <div class="text-14-regular text-text-base">
                <div class="flex items-center gap-x-2">
                  <Spinner />
                  <span>{language.t("provider.connect.status.inProgress")}</span>
                </div>
              </div>
            </Match>
            <Match when={controller.auth.state() === "form"}>
              <AuthFormView controller={controller} provider={provider} />
            </Match>
            <Match when={controller.auth.state() === "error"}>
              <div class="text-14-regular text-text-base">
                <div class="flex items-center gap-x-2">
                  <Icon name="circle-ban-sign" class="text-icon-critical-base" />
                  <span>{language.t("provider.connect.status.failed", { error: controller.auth.error() ?? "" })}</span>
                </div>
              </div>
            </Match>
            <Match when={controller.currentMethod()?.type === "key"}>
              <ApiAuthView controller={controller} provider={provider} />
            </Match>
            <Match when={controller.currentMethod()?.type === "oauth"}>
              <Switch>
                <Match when={controller.authorization()?.mode === "code"}>
                  <OAuthCodeView controller={controller} provider={provider} />
                </Match>
                <Match when={controller.authorization()?.mode === "auto"}>
                  <OAuthAutoView controller={controller} provider={provider} />
                </Match>
              </Switch>
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  )
}
