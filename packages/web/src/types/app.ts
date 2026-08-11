import type { LocationGetOutput } from "@opencode-ai/client"

/** Decoded file data used by the browser file viewer. */
export type DecodedFileContent = {
  type: "text" | "binary"
  content: string
  diff?: string
  patch?: {
    oldFileName: string
    newFileName: string
    oldHeader?: string
    newHeader?: string
    hunks: Array<{ oldStart: number; oldLines: number; newStart: number; newLines: number; lines: string[] }>
    index?: string
  }
  encoding?: "base64"
  mimeType?: string
}

/** Browser runtime locations; home is not supplied by V2. */
export type RuntimeLocations = Pick<LocationGetOutput, "directory"> & {
  home: string
  canonical: LocationGetOutput["project"]["canonical"]
}

/** Todo tool output has no generated V2 resource. */
export type TodoItem = {
  content: string
  status: string
  priority: string
}

/** LSP status is currently inferred from tool output; V2 has no resource for it. */
export type LspStatus = { id: string; name: string; root: string; status: "connected" | "error" }
