import type {
  PromptAgentAttachment,
  PromptFileAttachment,
  SessionPromptInput,
} from "@opencode-ai/client"
import { getFilename } from "@/utils/path"
import type { FileSelection } from "@/context/file"
import { encodeFilePath } from "@/context/file/path"
import type { AgentPart, FileAttachmentPart, ImageAttachmentPart, Prompt } from "@/context/prompt"
import { formatCommentNote } from "@/utils/comment-note"

type ContextFile = {
  key: string
  type: "file"
  path: string
  selection?: FileSelection
  comment?: string
  commentID?: string
  commentOrigin?: "review" | "file"
  preview?: string
}

type BuildRequestPartsInput = {
  prompt: Prompt
  context: ContextFile[]
  images: ImageAttachmentPart[]
  text: string
  messageID: string
  sessionID: string
  sessionDirectory: string
}

const absolute = (directory: string, path: string) => {
  if (path.startsWith("/")) return path
  if (/^[A-Za-z]:[\\/]/.test(path) || /^[A-Za-z]:$/.test(path)) return path
  if (path.startsWith("\\\\") || path.startsWith("//")) return path
  return `${directory.replace(/[\\/]+$/, "")}/${path}`
}

const fileQuery = (selection: FileSelection | undefined) =>
  selection ? `?start=${selection.startLine}&end=${selection.endLine}` : ""

const isFileAttachment = (part: Prompt[number]): part is FileAttachmentPart => part.type === "file"
const isAgentAttachment = (part: Prompt[number]): part is AgentPart => part.type === "agent"
type PromptRequest = Omit<SessionPromptInput, "sessionID">

export function buildRequestParts(input: BuildRequestPartsInput) {
  const requestFiles: PromptRequest["files"] extends ReadonlyArray<infer T> | undefined ? T[] : never = []
  const optimisticFiles: PromptFileAttachment[] = []
  const used = new Set<string>()

  const addFile = (file: { uri: string; mime: string; name?: string; mention?: { start: number; end: number; text: string }; data?: string }) => {
    requestFiles.push({ uri: file.uri, name: file.name, mention: file.mention })
    optimisticFiles.push({
      data: file.data ?? "",
      mime: file.mime,
      name: file.name,
      mention: file.mention,
      source: file.uri.startsWith("data:") ? { type: "inline" } : { type: "uri", uri: file.uri },
    })
  }

  for (const attachment of input.prompt.filter(isFileAttachment)) {
    const path = absolute(input.sessionDirectory, attachment.path)
    const uri = `file://${encodeFilePath(path)}${fileQuery(attachment.selection)}`
    used.add(uri)
    addFile({
      uri,
      mime: "text/plain",
      name: getFilename(attachment.path),
      mention: { start: attachment.start, end: attachment.end, text: attachment.content },
    })
  }

  const comments: string[] = []
  for (const item of input.context) {
    const path = absolute(input.sessionDirectory, item.path)
    const uri = `file://${encodeFilePath(path)}${fileQuery(item.selection)}`
    const comment = item.comment?.trim()
    if (comment) comments.push(formatCommentNote({ path: item.path, selection: item.selection, comment }))
    if (!comment && used.has(uri)) continue
    used.add(uri)
    addFile({ uri, mime: "text/plain", name: getFilename(item.path) })
  }

  for (const attachment of input.images) {
    const comma = attachment.dataUrl.indexOf(",")
    addFile({
      uri: attachment.dataUrl,
      data: comma < 0 ? attachment.dataUrl : attachment.dataUrl.slice(comma + 1),
      mime: attachment.mime,
      name: attachment.filename,
    })
  }

  const requestAgents: PromptAgentAttachment[] = input.prompt.filter(isAgentAttachment).map((attachment) => ({
    name: attachment.name,
    mention: { start: attachment.start, end: attachment.end, text: attachment.content },
  }))
  const text = [input.text, ...comments].filter(Boolean).join("\n")

  return {
    request: {
      id: input.messageID,
      text,
      files: requestFiles,
      agents: requestAgents,
    } satisfies PromptRequest,
    optimistic: {
      text,
      files: optimisticFiles,
      agents: requestAgents,
    },
  }
}
