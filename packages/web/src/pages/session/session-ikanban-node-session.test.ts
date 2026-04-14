import { beforeEach, describe, expect, test } from "bun:test"
import {
  getStoredNodeTaskFinished,
  getStoredNodeTaskSession,
  nodeTaskPromptPath,
  setStoredNodeTaskFinished,
  startNodeTaskSession,
  type BrowserStorage,
} from "./session-ikanban-node-session"

class MemoryStorage implements BrowserStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

describe("session ikanban node session", () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
  })

  test("builds the prompt.md path for a task node", () => {
    expect(nodeTaskPromptPath(".ikanban/example-project-smoke-test/task.yaml", "define-smoke-scope")).toBe(".ikanban/example-project-smoke-test/define-smoke-scope.md")
  })

  test("reuses a stored node session instead of creating a new one", async () => {
    storage.setItem(
      "ikanban.node-sessions:/repo/main",
      JSON.stringify({ ".ikanban/example-project-smoke-test/task.yaml#define-smoke-scope": { sessionID: "session-7", finished: false } }),
    )

    const createSession = async () => {
      throw new Error("should not create")
    }

    const readPrompt = async () => {
      throw new Error("should not read")
    }

    const navigated: string[] = []

    const result = await startNodeTaskSession({
      storage,
      directory: "/repo/main",
      taskPath: ".ikanban/example-project-smoke-test/task.yaml",
      nodeID: "define-smoke-scope",
      agent: "build",
      model: { providerID: "provider", modelID: "model" },
      readPrompt,
      createSession,
      promptSession: async () => {
        throw new Error("should not prompt")
      },
      navigateToSession: (sessionID) => navigated.push(sessionID),
    })

    expect(result).toEqual({ created: false, sessionID: "session-7" })
    expect(navigated).toEqual(["session-7"])
  })

  test("creates a session, sends the node prompt, and persists the session id", async () => {
    const prompts: Array<{ sessionID: string; agent: string; parts: Array<{ type: string; text?: string }> }> = []
    const navigated: string[] = []

    const result = await startNodeTaskSession({
      storage,
      directory: "/repo/main",
      taskPath: ".ikanban/example-project-smoke-test/task.yaml",
      nodeID: "define-smoke-scope",
      agent: "build",
      model: { providerID: "provider", modelID: "model" },
      variant: "balanced",
      readPrompt: async (path) => {
        expect(path).toBe(".ikanban/example-project-smoke-test/define-smoke-scope.md")
        return "Define the smoke test scope."
      },
      createSession: async () => ({ id: "session-9" }),
      promptSession: async (input) => {
        prompts.push({
          sessionID: input.sessionID,
          agent: input.agent,
          parts: input.parts.map((part) => ({ type: part.type, text: "text" in part ? part.text : undefined })),
        })
      },
      navigateToSession: (sessionID) => navigated.push(sessionID),
    })

    expect(result).toEqual({ created: true, sessionID: "session-9" })
    expect(prompts).toEqual([
      {
        sessionID: "session-9",
        agent: "build",
        parts: [{ type: "text", text: "Define the smoke test scope." }],
      },
    ])
    expect(navigated).toEqual(["session-9"])
    expect(
      getStoredNodeTaskSession(storage, "/repo/main", ".ikanban/example-project-smoke-test/task.yaml", "define-smoke-scope"),
    ).toBe("session-9")
    expect(
      getStoredNodeTaskFinished(storage, "/repo/main", ".ikanban/example-project-smoke-test/task.yaml", "define-smoke-scope"),
    ).toBe(false)
  })

  test("stores and clears the finished flag for a node task session", () => {
    storage.setItem(
      "ikanban.node-sessions:/repo/main",
      JSON.stringify({ ".ikanban/example-project-smoke-test/task.yaml#define-smoke-scope": "session-7" }),
    )

    setStoredNodeTaskFinished(storage, "/repo/main", ".ikanban/example-project-smoke-test/task.yaml", "define-smoke-scope", true)
    expect(
      getStoredNodeTaskFinished(storage, "/repo/main", ".ikanban/example-project-smoke-test/task.yaml", "define-smoke-scope"),
    ).toBe(true)
    expect(
      getStoredNodeTaskSession(storage, "/repo/main", ".ikanban/example-project-smoke-test/task.yaml", "define-smoke-scope"),
    ).toBe("session-7")

    setStoredNodeTaskFinished(storage, "/repo/main", ".ikanban/example-project-smoke-test/task.yaml", "define-smoke-scope", false)
    expect(
      getStoredNodeTaskFinished(storage, "/repo/main", ".ikanban/example-project-smoke-test/task.yaml", "define-smoke-scope"),
    ).toBe(false)
  })

  test("does not create a session when the prompt file is empty", async () => {
    let created = false

    await expect(
      startNodeTaskSession({
        storage,
        directory: "/repo/main",
        taskPath: ".ikanban/example-project-smoke-test/task.yaml",
        nodeID: "define-smoke-scope",
        agent: "build",
        model: { providerID: "provider", modelID: "model" },
        readPrompt: async () => "   ",
        createSession: async () => {
          created = true
          return { id: "session-10" }
        },
        promptSession: async () => undefined,
        navigateToSession: () => undefined,
      }),
    ).rejects.toThrow("Task prompt is empty")

    expect(created).toBe(false)
  })

  test("removes the stored session mapping when sending the prompt fails", async () => {
    await expect(
      startNodeTaskSession({
        storage,
        directory: "/repo/main",
        taskPath: ".ikanban/example-project-smoke-test/task.yaml",
        nodeID: "define-smoke-scope",
        agent: "build",
        model: { providerID: "provider", modelID: "model" },
        readPrompt: async () => "Define the smoke test scope.",
        createSession: async () => ({ id: "session-11" }),
        promptSession: async () => {
          throw new Error("send failed")
        },
        navigateToSession: () => undefined,
      }),
    ).rejects.toThrow("send failed")

    expect(
      getStoredNodeTaskSession(storage, "/repo/main", ".ikanban/example-project-smoke-test/task.yaml", "define-smoke-scope"),
    ).toBeUndefined()
  })
})
