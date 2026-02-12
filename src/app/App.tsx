import { basename, resolve } from "node:path";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";

import type { ProjectRef } from "../domain/project";
import type { TaskRuntime, TaskState } from "../domain/task";
import type { RuntimeLogEntry } from "../runtime/event-bus";
import { ProjectRegistry } from "../runtime/project-registry";
import { RuntimeEventBus } from "../runtime/event-bus";
import { OpenCodeRuntime } from "../runtime/opencode-runtime";
import { TaskOrchestrator, type TaskOrchestratorEvent } from "../runtime/task-orchestrator";
import { WorktreeManager } from "../runtime/worktree-manager";
import { nextRoute, ROUTE_DESCRIPTORS, type AppRoute } from "./routes";

type BannerTone = "info" | "success" | "warn" | "error";

type StatusBanner = {
  tone: BannerTone;
  message: string;
  at: number;
};

export type AppServices = {
  runtime: OpenCodeRuntime;
  projectRegistry: ProjectRegistry;
  orchestrator: TaskOrchestrator;
  worktreeManager: WorktreeManager;
  eventBus: RuntimeEventBus;
};

type AppProps = {
  services: AppServices;
  defaultProjectDirectory?: string;
  initialRoute?: AppRoute;
};

const MAX_LOG_ENTRIES = 200;

export function App({ services, defaultProjectDirectory, initialRoute = "project-selector" }: AppProps) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [busyMessage, setBusyMessage] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [statusBanner, setStatusBanner] = useState<StatusBanner>();
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>();
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [tasks, setTasks] = useState<TaskRuntime[]>([]);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [logs, setLogs] = useState<RuntimeLogEntry[]>([]);
  const [abortRequestedTaskIds, setAbortRequestedTaskIds] = useState<Record<string, true>>({});
  const [promptByTaskID, setPromptByTaskID] = useState<Record<string, string>>({});

  const pushBanner = useCallback((tone: BannerTone, message: string) => {
    setStatusBanner({
      tone,
      message,
      at: Date.now(),
    });
  }, []);

  const refreshProjects = useCallback(async () => {
    const nextProjects = await services.projectRegistry.listProjects();
    const activeProject = await services.projectRegistry.getActiveProject();

    setProjects(nextProjects);
    setActiveProjectId(activeProject?.id);

    if (nextProjects.length === 0) {
      setSelectedProjectIndex(0);
      return;
    }

    const selectedIndex = activeProject
      ? nextProjects.findIndex((project) => project.id === activeProject.id)
      : 0;

    setSelectedProjectIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [services.projectRegistry]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId),
    [projects, activeProjectId],
  );

  const tasksForActiveProject = useMemo(() => {
    if (!activeProject) {
      return [];
    }

    return tasks.filter((task) => task.projectId === activeProject.id);
  }, [activeProject, tasks]);

  const selectedTask = tasksForActiveProject[selectedTaskIndex];

  const taskLogs = useMemo(() => {
    if (!selectedTask) {
      return logs.slice(-10);
    }

    const scoped = logs.filter((entry) => !entry.taskId || entry.taskId === selectedTask.taskId);
    return scoped.slice(-10);
  }, [logs, selectedTask]);

  useEffect(() => {
    setSelectedProjectIndex((current) => {
      if (projects.length === 0) {
        return 0;
      }

      return Math.max(0, Math.min(current, projects.length - 1));
    });
  }, [projects]);

  useEffect(() => {
    setSelectedTaskIndex((current) => {
      if (tasksForActiveProject.length === 0) {
        return 0;
      }

      return Math.max(0, Math.min(current, tasksForActiveProject.length - 1));
    });
  }, [tasksForActiveProject]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      setLoading(true);
      setErrorMessage(undefined);

      try {
        await services.runtime.start();
        await ensureDefaultProject(services.projectRegistry, defaultProjectDirectory);

        if (cancelled) {
          return;
        }

        await refreshProjects();
        if (cancelled) {
          return;
        }

        setTasks(services.orchestrator.listTasks());
        pushBanner("success", "Runtime ready. Use Tab to switch views.");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(toErrorMessage(error));
        pushBanner("error", "Failed to initialize runtime.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
      void services.runtime.stop();
    };
  }, [services, defaultProjectDirectory, refreshProjects, pushBanner]);

  useEffect(() => {
    const unsubscribe = services.orchestrator.subscribe((event) => {
      relayOrchestratorEvent(event, services.eventBus, (taskID) => {
        return services.orchestrator.getTask(taskID)?.projectId ?? "pending";
      });
      setTasks(services.orchestrator.listTasks());
    });

    return unsubscribe;
  }, [services.orchestrator, services.eventBus]);

  useEffect(() => {
    const unsubscribeLogs = services.eventBus.subscribeToLogs((entry) => {
      setLogs((current) => {
        const next = [...current, entry];
        return next.slice(-MAX_LOG_ENTRIES);
      });
    });

    const unsubscribeUpdates = services.eventBus.subscribeToUiUpdates((update) => {
      const text = `${update.scope}.${update.action} (${update.taskId})`;
      if (update.eventType === "task.failed") {
        pushBanner("error", text);
        return;
      }

      pushBanner("info", text);
    });

    return () => {
      unsubscribeLogs();
      unsubscribeUpdates();
    };
  }, [services.eventBus, pushBanner]);

  const selectProject = useCallback(
    async (projectID: string) => {
      setBusyMessage("Selecting project...");
      try {
        const project = await services.projectRegistry.selectProject(projectID);
        setActiveProjectId(project.id);
        pushBanner("success", `Active project: ${project.name}`);
        setRoute("task-board");
      } catch (error) {
        setErrorMessage(toErrorMessage(error));
      } finally {
        setBusyMessage(undefined);
      }
    },
    [services.projectRegistry, pushBanner],
  );

  const runTask = useCallback(async () => {
    if (!activeProject) {
      pushBanner("warn", "No active project selected.");
      return;
    }

    const taskID = createTaskID(activeProject.id);
    const prompt = buildDefaultPrompt(activeProject.name, taskID);
    setPromptByTaskID((current) => ({
      ...current,
      [taskID]: prompt,
    }));

    setBusyMessage(`Running ${taskID}...`);
    try {
      await services.orchestrator.runTask({
        taskId: taskID,
        projectId: activeProject.id,
        initialPrompt: prompt,
        title: `Task ${taskID}`,
      });
      pushBanner("success", `Task ${taskID} finished.`);
    } catch (error) {
      pushBanner("error", toErrorMessage(error));
    } finally {
      setBusyMessage(undefined);
      setTasks(services.orchestrator.listTasks());
    }
  }, [activeProject, pushBanner, services.orchestrator]);

  const abortTask = useCallback(() => {
    if (!selectedTask) {
      pushBanner("warn", "No task selected.");
      return;
    }

    if (selectedTask.state === "completed" || selectedTask.state === "failed") {
      pushBanner("warn", `Task ${selectedTask.taskId} is already final (${selectedTask.state}).`);
      return;
    }

    setAbortRequestedTaskIds((current) => ({
      ...current,
      [selectedTask.taskId]: true,
    }));

    services.eventBus.emit("log.appended", {
      level: "warn",
      taskId: selectedTask.taskId,
      projectId: selectedTask.projectId,
      source: "ui",
      message: `Abort requested for ${selectedTask.taskId}, but orchestrator cancel API is not available yet.`,
    });
    pushBanner("warn", `Abort requested for ${selectedTask.taskId}.`);
  }, [selectedTask, services.eventBus, pushBanner]);

  const retryTask = useCallback(async () => {
    if (!selectedTask) {
      pushBanner("warn", "No task selected.");
      return;
    }

    if (selectedTask.state !== "failed") {
      pushBanner("warn", `Retry is only available for failed tasks.`);
      return;
    }

    if (!activeProject) {
      pushBanner("warn", "No active project selected.");
      return;
    }

    const retryTaskID = createTaskID(`${selectedTask.taskId}-retry`);
    const prompt = promptByTaskID[selectedTask.taskId] ?? buildRetryPrompt(selectedTask.taskId);
    setPromptByTaskID((current) => ({
      ...current,
      [retryTaskID]: prompt,
    }));

    setBusyMessage(`Retrying ${selectedTask.taskId}...`);
    try {
      await services.orchestrator.runTask({
        taskId: retryTaskID,
        projectId: activeProject.id,
        initialPrompt: prompt,
        title: `Retry ${selectedTask.taskId}`,
      });
      pushBanner("success", `Retry submitted: ${retryTaskID}`);
    } catch (error) {
      pushBanner("error", toErrorMessage(error));
    } finally {
      setBusyMessage(undefined);
      setTasks(services.orchestrator.listTasks());
    }
  }, [selectedTask, activeProject, promptByTaskID, services.orchestrator, pushBanner]);

  const cleanupWorktree = useCallback(async () => {
    if (!selectedTask) {
      pushBanner("warn", "No task selected.");
      return;
    }

    if (!selectedTask.worktreeDirectory) {
      pushBanner("warn", `Task ${selectedTask.taskId} has no worktree to clean.`);
      return;
    }

    const taskProject = projects.find((project) => project.id === selectedTask.projectId);
    if (!taskProject) {
      pushBanner("error", `Unknown project for task ${selectedTask.taskId}.`);
      return;
    }

    setBusyMessage(`Cleaning worktree for ${selectedTask.taskId}...`);
    try {
      const cleanup = await services.worktreeManager.cleanupTaskWorktree({
        taskId: selectedTask.taskId,
        projectDirectory: taskProject.rootDirectory,
        worktreeDirectory: selectedTask.worktreeDirectory,
        policy: "remove",
      });

      services.eventBus.emit("worktree.cleanup", {
        taskId: selectedTask.taskId,
        projectId: selectedTask.projectId,
        policy: cleanup.policy,
        worktreeDirectory: cleanup.worktreeDirectory,
        removed: cleanup.removed,
        updatedAt: Date.now(),
      });

      if (cleanup.removed && cleanup.worktreeDirectory) {
        services.eventBus.emit("worktree.removed", {
          taskId: selectedTask.taskId,
          projectId: selectedTask.projectId,
          directory: cleanup.worktreeDirectory,
          removedAt: Date.now(),
        });
      }

      pushBanner("success", `Cleanup ${cleanup.removed ? "removed" : "kept"} worktree.`);
    } catch (error) {
      pushBanner("error", toErrorMessage(error));
    } finally {
      setBusyMessage(undefined);
      setTasks(services.orchestrator.listTasks());
    }
  }, [selectedTask, projects, services.worktreeManager, services.eventBus, services.orchestrator, pushBanner]);

  useInput((input, key) => {
    if ((key.ctrl && input === "c") || input === "q") {
      exit();
      return;
    }

    if (loading) {
      return;
    }

    if (key.tab) {
      setRoute((current) => nextRoute(current));
      return;
    }

    if (route === "project-selector") {
      if (key.upArrow) {
        setSelectedProjectIndex((current) => Math.max(0, current - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedProjectIndex((current) => Math.min(projects.length - 1, current + 1));
        return;
      }

      if (key.return) {
        const project = projects[selectedProjectIndex];
        if (project) {
          void selectProject(project.id);
        }
        return;
      }

      if (input === "r") {
        void refreshProjects();
        pushBanner("info", "Project list refreshed.");
        return;
      }

      if (input === "b") {
        setRoute("task-board");
      }

      return;
    }

    if (key.upArrow) {
      setSelectedTaskIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedTaskIndex((current) => Math.min(tasksForActiveProject.length - 1, current + 1));
      return;
    }

    if (input === "p") {
      setRoute("project-selector");
      return;
    }

    if (input === "r") {
      void runTask();
      return;
    }

    if (input === "a") {
      abortTask();
      return;
    }

    if (input === "t") {
      void retryTask();
      return;
    }

    if (input === "x") {
      void cleanupWorktree();
      return;
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="cyanBright">iKanban</Text>
        <Text> - {ROUTE_DESCRIPTORS[route].title}</Text>
        <Text color={services.runtime.isRunning() ? "green" : "red"}> | runtime {services.runtime.isRunning() ? "up" : "down"}</Text>
      </Box>

      {statusBanner ? (
        <Box marginBottom={1}>
          <Text color={toInkColor(statusBanner.tone)}>
            [{statusBanner.tone.toUpperCase()}] {statusBanner.message} ({formatTime(statusBanner.at)})
          </Text>
        </Box>
      ) : null}

      {errorMessage ? (
        <Box marginBottom={1}>
          <Text color="red">Error: {errorMessage}</Text>
        </Box>
      ) : null}

      {loading ? (
        <Text color="yellow">Loading runtime and project state...</Text>
      ) : (
        <Box flexDirection="row" columnGap={4}>
          <Box flexDirection="column" width={44}>
            <Text color="magentaBright">
              {route === "project-selector" ? "Projects" : `Tasks (${activeProject?.name ?? "none"})`}
            </Text>
            <Box marginTop={1} flexDirection="column">
              {route === "project-selector" ? (
                projects.length > 0 ? (
                  projects.map((project, index) => (
                    <Text key={project.id} color={index === selectedProjectIndex ? "green" : undefined}>
                      {index === selectedProjectIndex ? ">" : " "} {project.name} ({project.id})
                    </Text>
                  ))
                ) : (
                  <Text color="yellow">No projects registered.</Text>
                )
              ) : tasksForActiveProject.length > 0 ? (
                tasksForActiveProject.map((task, index) => {
                  const isAbortRequested =
                    abortRequestedTaskIds[task.taskId] && task.state !== "completed" && task.state !== "failed";

                  return (
                    <Text
                      key={task.taskId}
                      color={index === selectedTaskIndex ? "green" : stateColor(task.state)}
                    >
                      {index === selectedTaskIndex ? ">" : " "} {task.taskId} [{task.state}
                      {isAbortRequested ? ",abort_requested" : ""}]
                    </Text>
                  );
                })
              ) : (
                <Text color="yellow">No tasks for active project.</Text>
              )}
            </Box>
          </Box>

          <Box flexDirection="column" flexGrow={1}>
            <Text color="magentaBright">Details and Logs</Text>
            <Box marginTop={1} flexDirection="column">
              {selectedTask ? (
                <>
                  <Text>Task: {selectedTask.taskId}</Text>
                  <Text>State: {selectedTask.state}</Text>
                  <Text>Project: {selectedTask.projectId}</Text>
                  <Text>Session: {selectedTask.sessionID ?? "-"}</Text>
                  <Text>Worktree: {selectedTask.worktreeDirectory ?? "-"}</Text>
                  <Text>Error: {selectedTask.error ?? "-"}</Text>
                </>
              ) : (
                <Text color="yellow">Select a task to inspect details.</Text>
              )}
            </Box>

            <Box marginTop={1} flexDirection="column">
              <Text color="cyan">Recent logs</Text>
              {taskLogs.length > 0 ? (
                taskLogs.map((entry) => (
                  <Text key={`${entry.sequence}:${entry.source}`} color={entry.level === "error" ? "red" : entry.level === "warn" ? "yellow" : undefined}>
                    [{entry.level}] {truncate(entry.message, 120)}
                  </Text>
                ))
              ) : (
                <Text color="yellow">No log entries yet.</Text>
              )}
            </Box>
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        {route === "project-selector" ? (
          <Text color="gray">
            Keys: Up/Down move | Enter select | r refresh | b board | Tab switch | q quit
          </Text>
        ) : (
          <Text color="gray">
            Keys: Up/Down move | r run | a abort | t retry | x cleanup | p projects | Tab switch | q quit
          </Text>
        )}
      </Box>

      {busyMessage ? (
        <Box marginTop={1}>
          <Text color="yellow">{busyMessage}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

async function ensureDefaultProject(
  registry: ProjectRegistry,
  defaultProjectDirectory?: string,
): Promise<void> {
  const existingProjects = await registry.listProjects();
  if (existingProjects.length > 0) {
    return;
  }

  const rootDirectory = resolve(defaultProjectDirectory ?? process.cwd());
  const projectName = basename(rootDirectory) || "project";
  const projectID = toSlug(projectName) || `project-${Date.now()}`;

  await registry.addProject({
    id: projectID,
    name: projectName,
    rootDirectory,
  });
}

function relayOrchestratorEvent(
  event: TaskOrchestratorEvent,
  bus: RuntimeEventBus,
  resolveProjectID: (taskID: string) => string,
): void {
  switch (event.type) {
    case "task.enqueued": {
      bus.emit("task.created", {
        taskId: event.task.taskId,
        projectId: event.task.projectId,
        state: event.task.state,
        createdAt: event.task.createdAt,
      });
      return;
    }
    case "task.state.changed": {
      bus.emit("task.state.updated", {
        taskId: event.task.taskId,
        projectId: event.task.projectId,
        previousState: event.from,
        nextState: event.to,
        updatedAt: event.task.updatedAt,
        error: event.task.error,
      });
      if (event.to === "completed") {
        bus.emit("task.completed", {
          taskId: event.task.taskId,
          projectId: event.task.projectId,
          completedAt: event.task.updatedAt,
        });
      }
      return;
    }
    case "task.worktree.created": {
      bus.emit("worktree.created", {
        taskId: event.taskId,
        projectId: resolveProjectID(event.taskId),
        directory: event.worktree.directory,
        branch: event.worktree.branch,
        name: event.worktree.name,
        createdAt: event.worktree.createdAt,
      });
      return;
    }
    case "task.session.created": {
      bus.emit("session.created", {
        taskId: event.taskId,
        projectId: event.session.projectId,
        sessionID: event.session.sessionID,
        directory: event.session.directory,
        createdAt: event.session.createdAt,
        title: event.session.title,
      });
      return;
    }
    case "task.prompt.submitted": {
      const session = event.prompt.sessionID;
      bus.emit("session.prompt.submitted", {
        taskId: event.taskId,
        projectId: resolveProjectID(event.taskId),
        sessionID: session,
        prompt: event.prompt.prompt,
        submittedAt: event.prompt.submittedAt,
      });
      return;
    }
    case "task.cleanup.completed": {
      bus.emit("worktree.cleanup", {
        taskId: event.taskId,
        projectId: event.task.projectId,
        policy: event.cleanup.policy,
        worktreeDirectory: event.cleanup.worktreeDirectory,
        removed: event.cleanup.removed,
        updatedAt: Date.now(),
      });

      if (event.cleanup.removed && event.cleanup.worktreeDirectory) {
        bus.emit("worktree.removed", {
          taskId: event.taskId,
          projectId: event.task.projectId,
          directory: event.cleanup.worktreeDirectory,
          removedAt: Date.now(),
        });
      }
      return;
    }
    case "task.failed": {
      bus.emit("task.failed", {
        taskId: event.taskId,
        projectId: event.task.projectId,
        failedAt: event.task.updatedAt,
        error: event.error,
      });
      return;
    }
  }
}

function createTaskID(seed: string): string {
  const normalized = toSlug(seed);
  const base = normalized.length > 0 ? normalized : "task";
  return `${base}-${Date.now()}`;
}

function buildDefaultPrompt(projectName: string, taskID: string): string {
  return `Work on task ${taskID} in project ${projectName}. Analyze the repository and implement the next meaningful change with tests.`;
}

function buildRetryPrompt(taskID: string): string {
  return `Retry task ${taskID}. Address the previous failure and continue with the same objective.`;
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 36);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function toInkColor(tone: BannerTone): "blue" | "green" | "yellow" | "red" {
  switch (tone) {
    case "info":
      return "blue";
    case "success":
      return "green";
    case "warn":
      return "yellow";
    case "error":
      return "red";
  }
}

function stateColor(state: TaskState): "yellow" | "cyan" | "green" | "red" | undefined {
  switch (state) {
    case "queued":
      return "yellow";
    case "creating_worktree":
      return "yellow";
    case "running":
      return "cyan";
    case "completed":
      return "green";
    case "failed":
      return "red";
    case "cleaning":
      return "yellow";
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
