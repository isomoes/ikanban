import { expect, test } from "bun:test"
import { createFileWatchLeases } from "./watch-lease"

test("two viewers share a watch and reopening waits for an outstanding unwatch", async () => {
  const acquire = createFileWatchLeases()
  const calls: string[] = []
  const closing = Promise.withResolvers<void>()
  const get = () => acquire("README.md", async () => { calls.push("watch") }, async () => {
    calls.push("unwatch")
    await closing.promise
  })
  const first = get()
  const second = get()
  await first.ready
  await first.release()
  expect(calls).toEqual(["watch"])

  const release = second.release()
  const reopened = get()
  await Promise.resolve()
  expect(calls).toEqual(["watch", "unwatch"])
  closing.resolve()
  await release
  await reopened.ready
  expect(calls).toEqual(["watch", "unwatch", "watch"])
  await reopened.release()
})
