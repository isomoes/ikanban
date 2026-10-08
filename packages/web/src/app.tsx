import "@/index.css"
import { DialogProvider } from "@ikanban/ui/context/dialog"
import { FileComponentProvider } from "@ikanban/ui/context/file"
import { Font } from "@ikanban/ui/font"
import { ThemeProvider } from "@ikanban/ui/theme/context"
import { MetaProvider } from "@solidjs/meta"
import { type BaseRouterProps, Router } from "@solidjs/router"
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query"
import { type Component, createRenderEffect, ErrorBoundary, type JSX, type ParentProps } from "solid-js"
import { Dynamic } from "solid-js/web"
import { CommandProvider } from "@/shell/commands/command"
import { GlobalProvider } from "@/runtime/server/runtime"
import { LanguageProvider, UiI18nBridge, type Locale } from "@/runtime/i18n/language"
import { ServerConnection, ServersProvider } from "@/runtime/server/registry"
import { SettingsProvider } from "@/settings/model"
import { TabsProvider } from "@/shell/tabs/tabs"
import { ErrorPage } from "@/shell/errors/error"
import { AppRoutes, File, preloadRoute } from "@/shell/routes/routes"
import { appBase } from "@/shell/routes/base"

export { preloadRoute }

function QueryProvider(props: ParentProps) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  })
  return <QueryClientProvider client={client}>{props.children}</QueryClientProvider>
}

function BodyTypography() {
  createRenderEffect(() => {
    if (typeof document === "undefined") return
    document.body.classList.remove("text-12-regular")
    document.body.classList.add("font-(family-name:--font-family-text)", "text-[13px]", "font-[440]")
  })

  return null
}

export function AppBaseProviders(props: ParentProps<{ locale?: Locale }>) {
  return (
    <MetaProvider>
      <Font />
      <ThemeProvider>
        <LanguageProvider locale={props.locale}>
          <UiI18nBridge>
            <ErrorBoundary
              fallback={(error) => {
                void import("@sentry/solid").then(({ captureException }) => captureException(error))
                return <ErrorPage error={error} />
              }}
            >
              <QueryProvider>
                <DialogProvider>
                  <FileComponentProvider component={File}>{props.children}</FileComponentProvider>
                </DialogProvider>
              </QueryProvider>
            </ErrorBoundary>
          </UiI18nBridge>
        </LanguageProvider>
      </ThemeProvider>
    </MetaProvider>
  )
}

export function AppInterface(props: {
  children?: JSX.Element
  defaultServer?: ServerConnection.Key
  canonicalLocalServer?: ServerConnection.Key
  servers?: Array<ServerConnection.Http>
  router?: Component<BaseRouterProps>
}) {
  // The visual layout lives in the router root so it remains mounted across
  // route changes. Draft and session routes override only their server-bound data
  // providers beneath it.
  const Root = (rootProps: ParentProps) => (
    <TabsProvider>
      <GlobalProvider>
        <BodyTypography />
        <CommandProvider>
          {props.children}
          {rootProps.children}
        </CommandProvider>
      </GlobalProvider>
    </TabsProvider>
  )

  return (
    <ServersProvider
      defaultServer={props.defaultServer}
      canonicalLocalServer={props.canonicalLocalServer}
      servers={props.servers}
    >
      <SettingsProvider>
        <Dynamic component={props.router ?? Router} base={appBase} root={Root}>
          <AppRoutes />
        </Dynamic>
      </SettingsProvider>
    </ServersProvider>
  )
}
