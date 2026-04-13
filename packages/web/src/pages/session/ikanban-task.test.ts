import { describe, expect, it } from "bun:test"
import { parseIkanbanTaskYaml, taskStages } from "./ikanban-task"

describe("parseIkanbanTaskYaml", () => {
  it("parses the skill task.yaml shape", () => {
    const value = parseIkanbanTaskYaml(
      [
        "task:",
        "  id: example-project-smoke-test",
        "  name: add project smoke test",
        "  description: Plan adding a simple smoke test that verifies the project starts and the main flow loads without errors.",
        "  nodes:",
        "    - id: review-test-surface",
        "      dep_ids: []",
        "      name: review test surface",
        "      description: Identify the current test setup.",
        "      stage: discovery",
        "    - id: define-smoke-scope",
        "      dep_ids: [review-test-surface]",
        "      name: define smoke scope",
        "      description: Define the exact success criteria.",
        "      stage: design",
      ].join("\n"),
      ".ikanban/example-project-smoke-test/task.yaml",
    )

    expect(value).toBeDefined()
    expect(value?.id).toBe("example-project-smoke-test")
    expect(value?.nodes.map((node) => node.id)).toEqual(["review-test-surface", "define-smoke-scope"])
    expect(value?.nodes[1]?.dep_ids).toEqual(["review-test-surface"])
    expect(value ? taskStages(value) : []).toEqual(["discovery", "design"])
  })

  it("rejects tasks with missing dependency targets", () => {
    const value = parseIkanbanTaskYaml(
      [
        "task:",
        "  id: broken-task",
        "  name: broken task",
        "  description: broken",
        "  nodes:",
        "    - id: only-node",
        "      dep_ids: [missing-node]",
        "      name: only node",
        "      description: broken dep",
        "      stage: discovery",
      ].join("\n"),
      ".ikanban/broken-task/task.yaml",
    )

    expect(value).toBeUndefined()
  })
})
