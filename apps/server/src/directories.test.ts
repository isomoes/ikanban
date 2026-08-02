import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { browseDirectories } from "./directories.js";

describe("browseDirectories", () => {
  it("returns canonical, sorted child directories and excludes files", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-web-directories-"));
    await mkdir(join(root, "zeta"));
    await mkdir(join(root, "Alpha"));
    await writeFile(join(root, "notes.txt"), "not a directory");

    try {
      const result = await browseDirectories(`${root}/.`);
      expect(result.path).toBe(root);
      expect(result.parent).toBe(tmpdir());
      expect(result.directories).toEqual([
        { name: "Alpha", path: join(root, "Alpha") },
        { name: "zeta", path: join(root, "zeta") },
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects relative, missing, and file paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-web-directories-"));
    const file = join(root, "file.txt");
    await writeFile(file, "file");

    try {
      await expect(browseDirectories("relative/path")).rejects.toThrow("absolute");
      await expect(browseDirectories(join(root, "missing"))).rejects.toThrow();
      await expect(browseDirectories(file)).rejects.toThrow("directory");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
