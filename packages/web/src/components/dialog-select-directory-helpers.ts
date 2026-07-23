type DirectoryClient = {
  client: {
    file: {
      list(input: { directory: string; path: string }): PromiseLike<{
        data?: Array<{ name: string; absolute: string; type: string }>
      }>
    }
  }
}

export function toggleSelectedDirectory(selected: string[], directory: string) {
  return selected.includes(directory) ? selected.filter((item) => item !== directory) : [...selected, directory]
}

export async function listInitialDirectories(sdk: DirectoryClient, directory: string) {
  const result = await sdk.client.file.list({ directory, path: "" })
  return (result.data ?? [])
    .filter((node) => node.type === "directory")
    .map((node) => ({ name: node.name, absolute: node.absolute }))
}
