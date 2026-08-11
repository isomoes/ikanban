import { describe, expect, test } from "bun:test"
import type { SessionMessageInfo as Message } from "@opencode-ai/client"
import { applyOptimisticAdd, applyOptimisticRemove } from "./sync"

const userMessage = (id: string, _sessionID: string): Message => ({
  id,
  type: "user",
  time: { created: 1 },
  text: "",
})

describe("sync optimistic reducers", () => {
  test("applyOptimisticAdd inserts native messages in sorted order", () => {
    const sessionID = "ses_1"
    const draft = {
      message: { [sessionID]: [userMessage("msg_2", sessionID)] },
    }

    applyOptimisticAdd(draft, {
      sessionID,
      message: userMessage("msg_1", sessionID),
    })

    expect(draft.message[sessionID]?.map((x) => x.id)).toEqual(["msg_1", "msg_2"])
  })

  test("applyOptimisticRemove removes the native message", () => {
    const sessionID = "ses_1"
    const draft = {
      message: { [sessionID]: [userMessage("msg_1", sessionID), userMessage("msg_2", sessionID)] },
    }

    applyOptimisticRemove(draft, { sessionID, messageID: "msg_1" })

    expect(draft.message[sessionID]?.map((x) => x.id)).toEqual(["msg_2"])
  })
})
