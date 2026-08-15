/** Browser stand-in for the vendored loader's only Node-only import. */
export const createRequire = (): never => {
  throw new Error('node:module is not available in the browser')
}

export type LoadHookContext = never
