import type * as V2 from "@opencode/client"
import type * as UI from "./types"

export const projectView = (project: V2.Project): UI.Project => ({ ...project, worktree: project.canonical })
export function sessionView(session: V2.SessionInfo): UI.Session {
  return {
    ...session,
    directory: session.location.directory,
    title: session.title ?? "New session",
    slug: session.id,
    version: "2",
  }
}

export function permissionView(request: V2.PermissionRequest): UI.PermissionRequest {
  return {
    id: request.id,
    sessionID: request.sessionID,
    permission: request.action,
    patterns: request.resources,
    always: request.save ?? [],
    metadata: request.metadata ?? {},
    tool: request.source ? { messageID: request.source.messageID, callID: request.source.id } : undefined,
  }
}

export function questionView(form: V2.FormInfo): UI.QuestionRequest {
  return {
    id: form.id,
    sessionID: form.sessionID,
    form,
    questions: form.fields
      .filter((field) => !("hidden" in field && field.hidden))
      .map((field) => ({
        header: field.title ?? field.key,
        question: field.description ?? field.title ?? form.title,
        multiple: field.type === "multiselect",
        custom: "custom" in field ? field.custom !== false : true,
        options:
          "options" in field
            ? (field.options ?? []).map((option) => ({ label: option.label, description: option.description ?? "" }))
            : [],
      })),
  }
}

export function modelView(model: V2.ModelInfo): UI.Model {
  const modalities = (list: string[]) => ({
    text: list.includes("text"),
    audio: list.includes("audio"),
    image: list.includes("image"),
    video: list.includes("video"),
    pdf: list.includes("pdf"),
  })
  const cost = model.cost[0]
  return {
    id: model.id,
    providerID: model.providerID,
    name: model.name,
    family: model.family,
    release_date: model.time.released ? new Date(model.time.released).toISOString() : "",
    status: model.status,
    limit: model.limit,
    cost: {
      input: cost?.input ?? 0,
      output: cost?.output ?? 0,
      cache_read: cost?.cache?.read,
      cache_write: cost?.cache?.write,
    },
    capabilities: {
      temperature: true,
      reasoning: model.variants.length > 0,
      attachment: model.capabilities.input.some((x) => x !== "text"),
      toolcall: model.capabilities.tools,
      input: modalities(model.capabilities.input),
      output: modalities(model.capabilities.output),
      interleaved: false,
    },
    variants: Object.fromEntries(model.variants.map((variant) => [variant.id, variant.settings ?? {}])),
    options: model.settings ?? {},
    headers: model.headers ?? {},
    api: { id: model.modelID, url: "", npm: model.package ?? "" },
  }
}

const emptyTokens = (): UI.Tokens => ({ input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } })
export type MessageView = { info: UI.Message; parts: UI.Part[] }

/** Stable part IDs let the existing Solid stores reconcile streamed content in place. */
export function messageViews(
  session: V2.SessionInfo,
  messages: V2.SessionMessageInfo[],
  previousUserID = "",
): MessageView[] {
  let parentID = previousUserID
  let agent = session.agent ?? ""
  let model = session.model
  const output: MessageView[] = []
  for (const message of messages) {
    if (message.type === "agent-switched") {
      agent = message.agent
      continue
    }
    if (message.type === "model-switched") {
      model = message.model
      continue
    }
    const base = { sessionID: session.id, messageID: message.id }
    if (message.type === "user") {
      parentID = message.id
      const info: UI.UserMessage = {
        id: message.id,
        sessionID: session.id,
        role: "user",
        time: message.time,
        agent,
        model: { providerID: model?.providerID ?? "", modelID: model?.id ?? "" },
        variant: model?.variant,
      }
      const parts: UI.Part[] = [{ ...base, id: `${message.id}:0000`, type: "text", text: message.text }]
      for (const [index, file] of (message.files ?? []).entries()) {
        parts.push({
          ...base,
          id: `${message.id}:file:${index}`,
          type: "file",
          filename: file.name,
          mime: file.mime,
          url: `data:${file.mime};base64,${file.data}`,
        })
      }
      for (const [index, item] of (message.agents ?? []).entries())
        parts.push({ ...base, id: `${message.id}:agent:${index}`, type: "agent", name: item.name })
      output.push({ info, parts })
      continue
    }
    if (message.type === "assistant") {
      const info: UI.AssistantMessage = {
        id: message.id,
        sessionID: session.id,
        role: "assistant",
        parentID,
        time: message.time,
        modelID: message.model.id,
        providerID: message.model.providerID,
        variant: message.model.variant,
        agent: message.agent,
        mode: message.agent,
        path: { cwd: session.location.directory, root: session.location.directory },
        cost: message.cost ?? 0,
        tokens: message.tokens ?? emptyTokens(),
        finish: message.finish,
        error: message.error ? { name: "APIError", data: { message: message.error.message } } : undefined,
      }
      const parts: UI.Part[] = message.content.map((content, index): UI.Part => {
        const part = { ...base, id: `${message.id}:${String(index).padStart(4, "0")}` }
        if (content.type === "text")
          return {
            ...part,
            type: "text",
            text: content.text,
            time: { start: message.time.created, end: message.time.completed },
          }
        if (content.type === "reasoning")
          return {
            ...part,
            type: "reasoning",
            text: content.text,
            time: { start: message.time.created, end: message.time.completed },
          }
        const state = content.state
        const tool = { ...part, type: "tool" as const, callID: content.id, tool: content.name }
        const start = content.time.ran ?? content.time.created
        if (state.status === "streaming") return { ...tool, state: { status: "pending", input: {}, raw: state.input } }
        if (state.status === "running")
          return {
            ...tool,
            state: { status: "running", input: state.input, metadata: state.metadata, time: { start } },
          }
        if (state.status === "error")
          return {
            ...tool,
            state: {
              status: "error",
              input: state.input,
              error: state.error.message,
              metadata: state.metadata,
              time: { start, end: content.time.completed ?? start },
            },
          }
        return {
          ...tool,
          state: {
            status: "completed",
            input: state.input,
            title: content.name,
            metadata: state.metadata ?? {},
            output: state.content
              .filter((item) => item.type === "text")
              .map((item) => item.text)
              .join("\n"),
            time: { start, end: content.time.completed ?? start },
            attachments: state.content
              .filter((item) => item.type === "file")
              .map((item, i) => ({
                ...base,
                id: `${part.id}:attachment:${i}`,
                type: "file",
                mime: item.mime,
                url: item.uri,
                filename: item.name ?? undefined,
              })),
          },
        }
      })
      output.push({ info, parts })
      continue
    }
    if (message.type === "compaction" && message.status === "completed") {
      output.push({
        info: {
          id: message.id,
          sessionID: session.id,
          role: "assistant",
          parentID,
          time: { ...message.time, completed: message.time.created },
          modelID: message.model?.id ?? "",
          providerID: message.model?.providerID ?? "",
          agent,
          mode: agent,
          path: { cwd: session.location.directory, root: session.location.directory },
          cost: message.cost ?? 0,
          tokens: message.tokens ?? emptyTokens(),
          summary: true,
        },
        parts: [{ ...base, id: `${message.id}:0000`, type: "text", text: message.summary }],
      })
    }
  }
  return output
}

export function fileView(bytes: Uint8Array, path: string): UI.FileContent {
  const extension = path.split(".").pop()?.toLowerCase() ?? ""
  const mime: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    ico: "image/x-icon",
    avif: "image/avif",
  }
  if (mime[extension] || bytes.subarray(0, 8192).includes(0)) {
    let binary = ""
    for (let offset = 0; offset < bytes.length; offset += 8192)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    return {
      type: "binary",
      content: btoa(binary),
      encoding: "base64",
      mimeType: mime[extension] ?? "application/octet-stream",
    }
  }
  return { type: "text", content: new TextDecoder().decode(bytes) }
}
