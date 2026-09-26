import { useLanguage } from "@/runtime/i18n/language"
import { useServerSDK } from "@/runtime/server/client"
import { dismissToast, showToast } from "@/shell/notifications/toast"
import { useCommand } from "./command"

export function useServerReloadCommand() {
  const command = useCommand()
  const language = useLanguage()
  const sdk = useServerSDK()

  // Rebuilds every loaded location on the server; clients recover through location.shutdown.
  const reload = async () => {
    const pending = showToast({ title: language.t("command.server.reload.pending"), persistent: true })
    await sdk.api.location
      .reload()
      .then(() => showToast({ variant: "success", title: language.t("command.server.reload.done") }))
      .catch((err: unknown) =>
        showToast({
          title: language.t("common.requestFailed"),
          description: err instanceof Error ? err.message : String(err),
        }),
      )
      .finally(() => dismissToast(pending))
  }

  command.register("server", () => [
    {
      id: "server.reload",
      title: language.t("command.server.reload"),
      category: language.t("command.category.server"),
      onSelect: () => void reload(),
    },
  ])
}
