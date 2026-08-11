type DirectoryClient = {
  client: {
    file: {
      list(input: { location: { directory: string }; path: string }): PromiseLike<{
        data: Array<{ path: string; type: "file" | "directory" }>
      }>
    }
  }
}

export async function listInitialDirectories(sdk: DirectoryClient, directory: string) {
  const result = await sdk.client.file.list({ location: { directory }, path: "" })
  return result.data
    .filter((node) => node.type === "directory")
    .map((node) => {
      const path = node.path.replaceAll("\\", "/")
      const name = path.replace(/\/+$/, "").split("/").pop() ?? path
      const absolute = /^(?:\/|[A-Za-z]:\/)/.test(path)
        ? path
        : `${directory.replace(/[\\/]+$/, "")}/${path.replace(/^\/+/, "")}`
      return { name, absolute }
    })
}
