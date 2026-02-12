export const CONVERSATION_ROLES = ["system", "user", "assistant", "tool"] as const;

export type ConversationRole = (typeof CONVERSATION_ROLES)[number];

export type ConversationSessionMeta = {
  sessionID: string;
  projectId: string;
  taskId: string;
  directory: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt?: number;
};

export type ConversationMessageMeta = {
  id: string;
  sessionID: string;
  role: ConversationRole;
  createdAt: number;
  partCount: number;
  preview: string;
  hasError: boolean;
};

export type ConversationMessageLike = {
  id: string;
  sessionID: string;
  role: string;
  createdAt: number;
  parts?: readonly { text?: string }[];
  error?: unknown;
};

export function isConversationRole(value: string): value is ConversationRole {
  return (CONVERSATION_ROLES as readonly string[]).includes(value);
}

export function toConversationMessageMeta(message: ConversationMessageLike): ConversationMessageMeta {
  const preview = message.parts?.map((part) => part.text ?? "").join("").trim() ?? "";

  return {
    id: message.id,
    sessionID: message.sessionID,
    role: isConversationRole(message.role) ? message.role : "assistant",
    createdAt: message.createdAt,
    partCount: message.parts?.length ?? 0,
    preview,
    hasError: message.error != null,
  };
}

export function updateSessionActivity(
  session: ConversationSessionMeta,
  at: number = Date.now(),
): ConversationSessionMeta {
  return {
    ...session,
    updatedAt: at,
    lastMessageAt: at,
  };
}
