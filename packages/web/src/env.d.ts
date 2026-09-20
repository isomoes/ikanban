import "solid-js"

interface ImportMetaEnv {
  readonly VITE_OPENCODE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: true
    }
  }
}
