import { expect, test } from "bun:test"
import { searchProjects } from "./project-search"

test("searches projects by fuzzy name and path, ignoring case", () => {
  const projects = [
    { worktree: "/home/user/code/js/ikanban" },
    { name: "Paper Tools", worktree: "/home/user/research/writing" },
    { worktree: "/home/user/other" },
  ]
  expect(searchProjects(projects, "kbn")).toEqual([projects[0]!])
  expect(searchProjects(projects, "KAN")).toEqual([projects[0]!])
  expect(searchProjects(projects, "pptl")).toEqual([projects[1]!])
  expect(searchProjects(projects, "writing")).toEqual([projects[1]!])
  expect(searchProjects(projects, "zzzz")).toEqual([])
  expect(searchProjects(projects, "  ")).toBe(projects)
})
