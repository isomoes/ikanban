import { Component, createMemo } from "solid-js"
import { useParams } from "@solidjs/router"
import { useSync } from "@/context/sync"
import { useLanguage } from "@/context/language"
import { Dialog } from "@/ui/components/dialog"
import { List } from "@/ui/components/list"
import type { TextPart as SDKTextPart, UserMessage } from "@opencode-ai/sdk/v2/client"

interface TimelineMessage {
  id: string
  text: string
  time: string
  message?: UserMessage
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { timeStyle: "short" })
}

export const DialogSessionTimeline: Component<{
  onSelect: (message: UserMessage | undefined) => void
}> = (props) => {
  const params = useParams()
  const sync = useSync()
  const language = useLanguage()

  const messages = createMemo((): TimelineMessage[] => {
    const sessionID = params.id
    if (!sessionID) return []

    const revert = sync.session.get(sessionID)?.revert?.messageID
    const sessionMessages = sync.data.message[sessionID] ?? []
    const result: TimelineMessage[] = []
    let latestUserMessage: UserMessage | undefined

    for (const message of sessionMessages) {
      if (message.role !== "user") continue
      latestUserMessage = message

      const parts = sync.data.part[message.id] ?? []
      const textPart = parts.find((x): x is SDKTextPart => x.type === "text" && !x.synthetic && !x.ignored)
      if (!textPart) continue

      result.push({
        id: message.id,
        text: textPart.text.replace(/\n/g, " ").slice(0, 200),
        time: formatTime(new Date(message.time.created)),
        message,
      })
    }

    result.reverse()

    if (revert && latestUserMessage) {
      result.unshift({
        id: "latest",
        text: language.t("dialog.timeline.latest"),
        time: formatTime(new Date(latestUserMessage.time.created)),
      })
    }

    return result
  })

  return (
    <Dialog title={language.t("command.session.timeline")}>
      <List
        class="flex-1 min-h-0 [&_[data-slot=list-scroll]]:flex-1 [&_[data-slot=list-scroll]]:min-h-0"
        search={{ placeholder: language.t("common.search.placeholder"), autofocus: true }}
        emptyMessage={language.t("dialog.timeline.empty")}
        key={(item) => item.id}
        items={messages}
        filterKeys={["text"]}
        onSelect={(item) => props.onSelect(item?.message)}
      >
        {(item) => (
          <div class="w-full flex items-center gap-2">
            <span class="truncate flex-1 min-w-0 text-left font-normal">{item.text}</span>
            <span class="text-text-weak shrink-0 font-normal">{item.time}</span>
          </div>
        )}
      </List>
    </Dialog>
  )
}
