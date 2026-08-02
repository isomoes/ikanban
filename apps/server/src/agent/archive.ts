import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface SessionArchiveStore {
  has(workspace: string, sessionId: string): boolean;
  archive(workspace: string, sessionId: string): Promise<void>;
}

interface ArchiveEntry {
  workspace: string;
  sessionId: string;
}

function key(workspace: string, sessionId: string): string {
  return JSON.stringify([workspace, sessionId]);
}

function parseKey(value: string): ArchiveEntry {
  const [workspace, sessionId] = JSON.parse(value) as [string, string];
  return { workspace, sessionId };
}

export class FileSessionArchiveStore implements SessionArchiveStore {
  readonly #path: string;
  readonly #archived: Set<string>;
  #tail: Promise<void> = Promise.resolve();

  private constructor(path: string, archived: Set<string>) {
    this.#path = path;
    this.#archived = archived;
  }

  static async open(path: string): Promise<FileSessionArchiveStore> {
    let value: unknown;
    try {
      value = JSON.parse(await readFile(path, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return new FileSessionArchiveStore(path, new Set());
      throw error;
    }
    if (
      typeof value !== "object"
      || value === null
      || !("version" in value)
      || value.version !== 1
      || !("archived" in value)
      || !Array.isArray(value.archived)
      || !value.archived.every((entry) =>
        typeof entry === "object"
        && entry !== null
        && "workspace" in entry
        && typeof entry.workspace === "string"
        && "sessionId" in entry
        && typeof entry.sessionId === "string"
      )
    ) {
      throw new Error(`Invalid Pi Web archive metadata at ${path}.`);
    }
    return new FileSessionArchiveStore(
      path,
      new Set(value.archived.map((entry) => key(entry.workspace as string, entry.sessionId as string))),
    );
  }

  has(workspace: string, sessionId: string): boolean {
    return this.#archived.has(key(workspace, sessionId));
  }

  archive(workspace: string, sessionId: string): Promise<void> {
    const archiveKey = key(workspace, sessionId);
    const operation = this.#tail.then(async () => {
      if (this.#archived.has(archiveKey)) return;
      this.#archived.add(archiveKey);
      try {
        await this.#persist();
      } catch (error) {
        this.#archived.delete(archiveKey);
        throw error;
      }
    });
    this.#tail = operation.catch(() => undefined);
    return operation;
  }

  async #persist(): Promise<void> {
    const archived = [...this.#archived].map(parseKey).sort((left, right) =>
      left.workspace.localeCompare(right.workspace) || left.sessionId.localeCompare(right.sessionId)
    );
    await mkdir(dirname(this.#path), { recursive: true });
    const temporary = `${this.#path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ version: 1, archived }, null, 2)}\n`, "utf8");
    await rename(temporary, this.#path);
  }
}

export function openDefaultSessionArchiveStore(): Promise<FileSessionArchiveStore> {
  return FileSessionArchiveStore.open(join(homedir(), ".pi", "agent", "pi-web-archives.json"));
}
