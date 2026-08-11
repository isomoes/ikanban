import type { Project } from "@opencode-ai/client"

export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function sanitizeProject(project: Project) {
  if (!project.icon?.url && !project.icon?.override) return project
  return {
    ...project,
    icon: {
      ...project.icon,
      url: undefined,
      override: undefined,
    },
  }
}
