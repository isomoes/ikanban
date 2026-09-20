const ACTIVE_SERVER_KEY = "ikanban.activeServer"

type ServerStorage = Pick<Storage, "getItem" | "setItem">

function browserStorage() {
  try {
    return globalThis.sessionStorage
  } catch {
    return undefined
  }
}

export const ServerSession = {
  read(defaultServer: string, storage: ServerStorage | undefined = browserStorage()) {
    try {
      return storage?.getItem(ACTIVE_SERVER_KEY) || defaultServer
    } catch {
      return defaultServer
    }
  },
  write(server: string, storage: ServerStorage | undefined = browserStorage()) {
    try {
      storage?.setItem(ACTIVE_SERVER_KEY, server)
    } catch {
      return
    }
  },
}
