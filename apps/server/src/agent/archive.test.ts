import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileSessionArchiveStore } from "./archive.js";

describe("FileSessionArchiveStore", () => {
  it("persists archived session keys without modifying Pi session files", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-web-archives-"));
    const metadataPath = join(root, "state", "archives.json");

    try {
      const store = await FileSessionArchiveStore.open(metadataPath);
      expect(store.has("/work/one", "session-1")).toBe(false);

      await store.archive("/work/one", "session-1");
      const reopened = await FileSessionArchiveStore.open(metadataPath);

      expect(reopened.has("/work/one", "session-1")).toBe(true);
      expect(reopened.has("/work/two", "session-1")).toBe(false);
      expect(JSON.parse(await readFile(metadataPath, "utf8"))).toEqual({
        version: 1,
        archived: [{ workspace: "/work/one", sessionId: "session-1" }],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("deduplicates repeated archive requests", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-web-archives-"));
    const metadataPath = join(root, "archives.json");

    try {
      const store = await FileSessionArchiveStore.open(metadataPath);
      await Promise.all([
        store.archive("/work", "session-1"),
        store.archive("/work", "session-1"),
      ]);

      expect(JSON.parse(await readFile(metadataPath, "utf8")).archived).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
