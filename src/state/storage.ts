import { homedir } from "node:os"
import { join } from "node:path"
import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs"
import type { StorageData } from "./types.ts"

const DATA_DIR = join(homedir(), ".ikanban")
const DATA_FILE = join(DATA_DIR, "data.json")
const RUNTIME_LOG_FILE = join(DATA_DIR, "runtime.log")

const EMPTY_DATA: StorageData = { projects: [], tasks: [] }

export function loadData(): StorageData {
  try {
    if (!existsSync(DATA_FILE)) return { ...EMPTY_DATA, projects: [], tasks: [] }
    const raw = readFileSync(DATA_FILE, "utf-8")
    const parsed = JSON.parse(raw) as Partial<StorageData>
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    }
  } catch {
    return { ...EMPTY_DATA, projects: [], tasks: [] }
  }
}

export function saveData(data: StorageData): void {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8")
}

function safeSerialize(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    }
  }
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch {
    return String(value)
  }
}

export function appendRuntimeLog(
  level: "info" | "warn" | "error",
  message: string,
  meta?: unknown,
): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    const record = {
      time: new Date().toISOString(),
      level,
      message,
      meta: meta === undefined ? undefined : safeSerialize(meta),
    }
    appendFileSync(RUNTIME_LOG_FILE, `${JSON.stringify(record)}\n`, "utf-8")
  } catch {
    // best-effort logging only
  }
}
