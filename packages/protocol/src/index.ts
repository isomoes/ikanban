import { z } from "zod";

export const PROTOCOL_VERSION = 1 as const;

const commandBase = {
  protocolVersion: z.literal(PROTOCOL_VERSION),
  commandId: z.string().min(1),
};

export const ClientCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...commandBase, type: z.literal("session.new") }),
  z.object({ ...commandBase, type: z.literal("prompt.send"), text: z.string().trim().min(1) }),
  z.object({ ...commandBase, type: z.literal("prompt.steer"), text: z.string().trim().min(1) }),
  z.object({ ...commandBase, type: z.literal("prompt.followUp"), text: z.string().trim().min(1) }),
  z.object({ ...commandBase, type: z.literal("run.abort") }),
]);

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
