import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

const commandBase = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  commandId: z.string().min(1),
};

export const ClientCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...commandBase, type: z.literal("workspace.open"), path: z.string().min(1) }),
  z.object({ ...commandBase, type: z.literal("session.new"), workspace: z.string().min(1).optional() }),
  z.object({ ...commandBase, type: z.literal("session.switch"), workspace: z.string().min(1).optional(), sessionId: z.string().min(1) }),
  z.object({ ...commandBase, type: z.literal("session.archive"), workspace: z.string().min(1), sessionId: z.string().min(1) }),
  z.object({ ...commandBase, type: z.literal("model.set"), provider: z.string().min(1), modelId: z.string().min(1) }),
  z.object({ ...commandBase, type: z.literal("thinking.set"), level: z.enum(["off", "minimal", "low", "medium", "high", "xhigh", "max"]) }),
  z.object({ ...commandBase, type: z.literal("prompt.send"), text: z.string().trim().min(1) }),
  z.object({ ...commandBase, type: z.literal("prompt.steer"), text: z.string().trim().min(1) }),
  z.object({ ...commandBase, type: z.literal("prompt.followUp"), text: z.string().trim().min(1) }),
  z.object({ ...commandBase, type: z.literal("run.abort") }),
]);

export const ModelOptionSchema = z.object({
  provider: z.string(),
  id: z.string(),
  name: z.string(),
});

export const SessionOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  modified: z.string(),
  messageCount: z.number().int().nonnegative(),
  status: z.enum(["idle", "running", "replacing", "error"]).optional(),
});

export const WorkspaceOptionSchema = z.object({
  path: z.string(),
  name: z.string(),
  sessions: z.array(SessionOptionSchema),
});

export const SlashCommandOptionSchema = z.object({
  name: z.string(),
  description: z.string(),
  source: z.enum(["extension", "prompt", "skill"]),
});

export const TranscriptItemSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("message"), role: z.enum(["user", "assistant"]), text: z.string() }),
  z.object({ id: z.string(), type: z.literal("tool"), toolName: z.string(), status: z.enum(["running", "succeeded", "failed"]), output: z.string() }),
  z.object({ id: z.string(), type: z.literal("error"), message: z.string() }),
]);

export const AgentEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("run.started") }),
  z.object({ type: z.literal("run.finished") }),
  z.object({ type: z.literal("user.message"), itemId: z.string(), text: z.string() }),
  z.object({ type: z.literal("text.delta"), itemId: z.string(), delta: z.string() }),
  z.object({ type: z.literal("tool.started"), itemId: z.string(), toolName: z.string() }),
  z.object({ type: z.literal("tool.updated"), itemId: z.string(), output: z.string() }),
  z.object({ type: z.literal("tool.finished"), itemId: z.string(), output: z.string(), isError: z.boolean() }),
  z.object({ type: z.literal("agent.error"), message: z.string() }),
]);

export const RuntimeSnapshotSchema = z.object({
  workspace: z.string(),
  sessionId: z.string(),
  status: z.enum(["idle", "running", "replacing", "error"]),
  model: z.string().optional(),
  models: z.array(ModelOptionSchema).default([]),
  thinkingLevel: z.string().optional(),
  thinkingLevels: z.array(z.string()).default([]),
  sessions: z.array(SessionOptionSchema).default([]),
  workspaces: z.array(WorkspaceOptionSchema).default([]),
  commands: z.array(SlashCommandOptionSchema).default([]),
  items: z.array(TranscriptItemSchema),
});

const serverBase = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  sequence: z.number().int().nonnegative(),
};

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ ...serverBase, type: z.literal("state.snapshot"), snapshot: RuntimeSnapshotSchema }),
  z.object({ ...serverBase, type: z.literal("agent.event"), sessionId: z.string(), event: AgentEventSchema }),
  z.object({ ...serverBase, type: z.literal("command.accepted"), commandId: z.string() }),
  z.object({ ...serverBase, type: z.literal("command.rejected"), commandId: z.string(), reason: z.string() }),
]);

export type ClientCommand = z.infer<typeof ClientCommandSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type RuntimeSnapshot = z.infer<typeof RuntimeSnapshotSchema>;
export type TranscriptItem = z.infer<typeof TranscriptItemSchema>;
export type AgentEvent = z.infer<typeof AgentEventSchema>;
export type ModelOption = z.infer<typeof ModelOptionSchema>;
export type SessionOption = z.infer<typeof SessionOptionSchema>;
export type WorkspaceOption = z.infer<typeof WorkspaceOptionSchema>;
export type SlashCommandOption = z.infer<typeof SlashCommandOptionSchema>;
