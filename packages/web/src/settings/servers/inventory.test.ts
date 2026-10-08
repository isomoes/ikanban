import { describe, expect, test } from "bun:test"
import { ServerConnection } from "@/runtime/server/registry"
import { settingsProjects, settingsServers } from "./inventory"

const connection: ServerConnection.Http = {
  type: "http",
  displayName: "Build server",
  http: { url: "http://127.0.0.1:4000", password: "secret" },
}

test("settings project inventory reads metadata without acquiring directory stores", () => {
  const projects = Array.from({ length: 40 }, (_, index) => ({
    id: `project-${index}`,
    worktree: `/projects/${index}`,
    name: `Project ${index}`,
    icon: { color: "orange" },
    commands: { start: "bun install" },
    time: { created: 1, updated: 1, active: 1 },
    sandboxes: [],
    worktrees: [],
  }))
  const tracked = { ...projects[0], expanded: true, icon: { override: "local-icon" } }
  const inventory = settingsProjects({
    projects: { list: () => [tracked], closed: () => [projects[1].worktree] },
    sync: { data: { project: projects } },
  })

  expect(inventory).toHaveLength(39)
  expect(inventory[0]).toBe(tracked)
  expect(inventory.some((project) => project.id === projects[1].id)).toBe(false)
  expect(inventory[1]).toEqual({ ...projects[2], expanded: false })
  expect(inventory[38]).toEqual({ ...projects[39], expanded: false })
})

describe("settings server inventory", () => {
  test("lists each connection under its key and display name", () => {
    expect(settingsServers([connection])).toEqual([
      {
        key: ServerConnection.Key.make("http://127.0.0.1:4000"),
        name: "Build server",
        connection,
      },
    ])
  })

  test("falls back to the server address when there is no display name", () => {
    const unnamed: ServerConnection.Http = { type: "http", http: { url: "http://127.0.0.1:4001" } }
    expect(settingsServers([unnamed])[0].name).toBe("127.0.0.1:4001")
  })
})
