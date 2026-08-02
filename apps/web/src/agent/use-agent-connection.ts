import {
  ClientCommandSchema,
  PROTOCOL_VERSION,
  ServerMessageSchema,
  type ClientCommand,
} from "@pi-web/protocol";
import { useEffect, useRef, useState } from "react";
import { initialAgentState, reduceServerMessage, type AgentState } from "./reducer.js";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K & keyof T> : never;

export type ClientCommandInput = DistributiveOmit<ClientCommand, "protocolVersion" | "commandId">;

export interface DirectoryListing {
  path: string;
  parent: string | null;
  directories: { name: string; path: string }[];
}

export interface AgentConnection {
  state: AgentState;
  send(command: ClientCommandInput): string | undefined;
  openWorkspace(path: string): string | undefined;
  selectSession(workspace: string, sessionId: string): string | undefined;
  newSession(workspace: string): string | undefined;
  archiveSession(workspace: string, sessionId: string): string | undefined;
  browseDirectories(path: string): Promise<DirectoryListing>;
}

export function useAgentConnection(): AgentConnection {
  const [state, setState] = useState(initialAgentState);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let mounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (!mounted) return;

      const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${scheme}//${window.location.host}/api/events`);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (mounted) setState((current) => ({ ...current, connected: true }));
      });
      socket.addEventListener("message", (frame) => {
        if (!mounted) return;

        let payload: unknown;
        try {
          payload = JSON.parse(String(frame.data));
        } catch {
          setState((current) => ({ ...current, lastError: "Server sent an invalid message." }));
          return;
        }

        const parsed = ServerMessageSchema.safeParse(payload);
        if (!parsed.success) {
          setState((current) => ({ ...current, lastError: "Server sent an invalid message." }));
          return;
        }
        setState((current) => reduceServerMessage(current, parsed.data));
      });
      socket.addEventListener("close", () => {
        if (!mounted) return;
        if (socketRef.current === socket) socketRef.current = null;
        setState((current) => ({ ...current, connected: false }));
        reconnectTimer = setTimeout(connect, 1_000);
      });
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
    };
  }, []);

  const send = (input: ClientCommandInput): string | undefined => {
    const commandId = crypto.randomUUID();
    const parsed = ClientCommandSchema.safeParse({
      ...input,
      protocolVersion: PROTOCOL_VERSION,
      commandId,
    });

    if (!parsed.success) {
      setState((current) => ({ ...current, lastError: "Command is invalid." }));
      return undefined;
    }

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setState((current) => ({ ...current, lastError: "Agent connection is not open." }));
      return undefined;
    }

    socket.send(JSON.stringify(parsed.data));
    return commandId;
  };

  const browseDirectories = async (path: string): Promise<DirectoryListing> => {
    const response = await fetch(`/api/directories?path=${encodeURIComponent(path)}`);
    const payload: unknown = await response.json();
    if (!response.ok) {
      const reason = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Unable to browse directory.";
      throw new Error(reason);
    }
    if (
      typeof payload !== "object"
      || payload === null
      || !("path" in payload)
      || typeof payload.path !== "string"
      || !("parent" in payload)
      || (payload.parent !== null && typeof payload.parent !== "string")
      || !("directories" in payload)
      || !Array.isArray(payload.directories)
      || !payload.directories.every((entry) =>
        typeof entry === "object"
        && entry !== null
        && "name" in entry
        && typeof entry.name === "string"
        && "path" in entry
        && typeof entry.path === "string"
      )
    ) {
      throw new Error("Server sent an invalid directory listing.");
    }
    return payload as DirectoryListing;
  };

  return {
    state,
    send,
    openWorkspace: (path) => send({ type: "workspace.open", path }),
    selectSession: (workspace, sessionId) => send({ type: "session.switch", workspace, sessionId }),
    newSession: (workspace) => send({ type: "session.new", workspace }),
    archiveSession: (workspace, sessionId) => send({ type: "session.archive", workspace, sessionId }),
    browseDirectories,
  };
}
