import { getFilename } from "@opencode/util/path"
import fuzzysort from "fuzzysort"

export function searchProjects<T extends { name?: string; worktree: string }>(projects: T[], query: string): T[] {
  const value = query.trim()
  if (!value) return projects
  const candidates = projects.map((project) => ({
    project,
    name: project.name || getFilename(project.worktree) || project.worktree,
    path: project.worktree,
  }))
  return fuzzysort.go(value, candidates, { keys: ["name", "path"] }).map((match) => match.obj.project)
}
