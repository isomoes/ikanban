import { createSimpleContext } from "@/ui/context/index"
import { type Accessor, createMemo } from "solid-js"
import { useGlobalSDK, type GlobalSDKContext } from "./global-sdk"

export interface SDKContext {
  readonly directory: string
  readonly client: GlobalSDKContext["client"]
  readonly url: string
  createClient(opts: Parameters<GlobalSDKContext["createClient"]>[0]): GlobalSDKContext["client"]
}

export const { use: useSDK, provider: SDKProvider } = createSimpleContext<
  SDKContext,
  { directory: Accessor<string> }
>({
  name: "SDK",
  init: (props: { directory: Accessor<string> }) => {
    const globalSDK = useGlobalSDK()

    const directory = createMemo(props.directory)
    const client = createMemo(() =>
      globalSDK.createClient({
        directory: directory(),
        throwOnError: true,
      }),
    )

    return {
      get directory() {
        return directory()
      },
      get client() {
        return client()
      },
      get url() {
        return globalSDK.url
      },
      createClient(opts: Parameters<typeof globalSDK.createClient>[0]) {
        return globalSDK.createClient(opts)
      },
    }
  },
})
