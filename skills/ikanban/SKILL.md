---
name: ikanban
description: "Use when one concrete task needs dependency-aware staging instead of a flat checklist, especially when the output must be YAML"
---

# Ikanban

## Overview

Turn one concrete task into a small staged dependency graph and return raw YAML only.

## When to Use

Use this skill when:
- The user wants one task planned, not a roadmap.
- The work has real dependencies, not just a flat list.
- The work should be grouped into stages.
- The output must be valid YAML.

Do not use this skill when:
- The user wants execution instead of planning.
- The work is a simple unordered checklist.
- The output format is not YAML.

## Quick Reference

- Plan exactly one task.
- Use a small graph, usually `4-8` nodes.
- Use `3-5` meaningful stages.
- Give each node: `id`, `dep_ids`, `name`, `description`, `stage`.
- Use empty `dep_ids` for root nodes.
- Keep only real prerequisite edges.
- Write the YAML to `.ikanban/task.yaml`.
- Return raw YAML with no prose and no code fences.

## Output Contract

Always emit this shape and nothing else:

```yaml
task:
  name: <task name>
  description: <task summary>
  nodes:
    - id: <node id>
      dep_ids: []
      name: <short node name>
      description: <what this node delivers>
      stage: <stage name>
```

Rules:
- The output file path is fixed: `.ikanban/task.yaml`.
- `id` is unique, lowercase, and kebab-case.
- `dep_ids` contains only earlier prerequisite node ids.
- `name` is a short action phrase.
- `description` states the node outcome.
- `stage` is a lowercase label such as `discovery`, `design`, `implementation`, `verification`, or another task-specific phase.
- Do not add extra top-level keys.

## Implementation

1. Identify the single task being planned.
2. Choose the smallest set of meaningful stages.
3. Split the task into concrete subtasks.
4. Keep parallel work parallel; do not invent sequential chains.
5. Assign each node a unique kebab-case `id`.
6. Add only true prerequisites to `dep_ids`.
7. Check for cycles and missing ids.
8. Write the final YAML to `.ikanban/task.yaml`.
9. Emit raw YAML only.

## Common Mistakes

- Adding prose like "Here is the YAML" before the output.
- Wrapping the answer in Markdown code fences.
- Making every node depend on the previous one by default.
- Creating vague nodes like `do work` or `finish task`.
- Using stage labels as numbering instead of phases.
- Writing to any path other than `.ikanban/task.yaml`.
- Adding extra fields not defined by the contract.

## Quality Checks

- The graph plans one task only.
- Each node includes all five required fields.
- Every `dep_ids` entry references a defined node.
- The graph is acyclic.
- Stages clarify progression.
- The YAML is written to `.ikanban/task.yaml`.
- The YAML stands alone without commentary.

## Example

```yaml
task:
  name: add email login
  description: Plan adding email/password login to an existing app.
  nodes:
    - id: discover-auth-flow
      dep_ids: []
      name: review current auth
      description: Review the current auth flow and constraints.
      stage: discovery
    - id: design-login-contract
      dep_ids: [discover-auth-flow]
      name: define login contract
      description: Define the request, validation, and failure states.
      stage: design
    - id: implement-server-login
      dep_ids: [design-login-contract]
      name: build server login
      description: Add credential validation and session issuance.
      stage: implementation
    - id: implement-ui-login
      dep_ids: [design-login-contract]
      name: build login screen
      description: Add the form and submission flow for login.
      stage: implementation
    - id: verify-login-flow
      dep_ids: [implement-server-login, implement-ui-login]
      name: verify login flow
      description: Verify successful and failing login cases end to end.
      stage: verification
```
