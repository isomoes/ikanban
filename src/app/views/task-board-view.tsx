import { Box, Text } from "ink";

import type { TaskRuntime, TaskState } from "../../domain/task";

type TaskBoardViewProps = {
  tasks: TaskRuntime[];
  selectedTaskIndex: number;
  pendingTaskModelLabel: string;
};

export function TaskBoardView({ tasks, selectedTaskIndex, pendingTaskModelLabel }: TaskBoardViewProps) {
  if (tasks.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="gray">New task model: {pendingTaskModelLabel}</Text>
        <Text color="yellow">No tasks for active project.</Text>
      </Box>
    );
  }

  const selectedTaskId = tasks[selectedTaskIndex]?.taskId;
  const groupedTasks = groupTasksByColumn(tasks);

  return (
    <Box flexDirection="column">
      <Text color="gray">Press r to open review diff, m to merge, dd to delete selected task.</Text>
      <Text color="gray">New task model: {pendingTaskModelLabel}</Text>
      <Text color="cyan">Task board by status</Text>
      <Box marginTop={1} flexDirection="row" flexWrap="wrap" columnGap={2} rowGap={1}>
        {STATUS_COLUMNS.map((column) => {
          const columnTasks = groupedTasks[column.key];
          return (
            <Box key={column.key} flexDirection="column" width={20}>
              <Text color={column.color}>
                {column.label} ({columnTasks.length})
              </Text>
              {columnTasks.length > 0 ? (
                columnTasks.map((task) => {
                  const isSelected = task.taskId === selectedTaskId;
                  return (
                    <Text key={task.taskId} color={isSelected ? "green" : stateColor(task.state)}>
                      {isSelected ? ">" : " "} {task.taskId}
                    </Text>
                  );
                })
              ) : (
                <Text color="gray">(none)</Text>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

type StatusColumn = {
  key: "queued" | "running" | "review" | "finished" | "failed";
  label: string;
  states: TaskState[];
  color: "yellow" | "cyan" | "magenta" | "green" | "red";
};

const STATUS_COLUMNS: StatusColumn[] = [
  {
    key: "queued",
    label: "Queued",
    states: ["queued", "creating_worktree"],
    color: "yellow",
  },
  {
    key: "running",
    label: "Running",
    states: ["running"],
    color: "cyan",
  },
  {
    key: "review",
    label: "Review",
    states: ["review"],
    color: "magenta",
  },
  {
    key: "finished",
    label: "Finished",
    states: ["completed", "cleaning"],
    color: "green",
  },
  {
    key: "failed",
    label: "Failed",
    states: ["failed"],
    color: "red",
  },
];

function groupTasksByColumn(tasks: TaskRuntime[]): Record<StatusColumn["key"], TaskRuntime[]> {
  const grouped: Record<StatusColumn["key"], TaskRuntime[]> = {
    queued: [],
    running: [],
    review: [],
    finished: [],
    failed: [],
  };

  for (const task of tasks) {
    const column = STATUS_COLUMNS.find((candidate) => candidate.states.includes(task.state));
    if (!column) {
      continue;
    }

    grouped[column.key].push(task);
  }

  return grouped;
}

function stateColor(state: TaskState): "yellow" | "cyan" | "green" | "red" | "magenta" | undefined {
  switch (state) {
    case "queued":
      return "yellow";
    case "creating_worktree":
      return "yellow";
    case "running":
      return "cyan";
    case "review":
      return "magenta";
    case "completed":
      return "green";
    case "failed":
      return "red";
    case "cleaning":
      return "yellow";
  }
}
