import { readdir, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";

export interface DirectoryEntry {
  name: string;
  path: string;
}

export interface DirectoryListing {
  path: string;
  parent: string | null;
  directories: DirectoryEntry[];
}

export async function browseDirectories(path: string): Promise<DirectoryListing> {
  if (!isAbsolute(path)) throw new Error("Directory path must be absolute.");
  const resolved = await realpath(path);
  if (!(await stat(resolved)).isDirectory()) throw new Error(`${path} is not a directory.`);

  const entries = await readdir(resolved, { withFileTypes: true });
  const directories = (await Promise.all(entries.map(async (entry): Promise<DirectoryEntry | undefined> => {
    const child = join(resolved, entry.name);
    try {
      if (!entry.isDirectory() && (!entry.isSymbolicLink() || !(await stat(child)).isDirectory())) return;
      return { name: entry.name, path: child };
    } catch {
      return;
    }
  }))).filter((entry): entry is DirectoryEntry => entry !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  const parent = dirname(resolved);
  return { path: resolved, parent: parent === resolved ? null : parent, directories };
}
