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

export interface AgentConnection {
  state: AgentState;
  send(command: ClientCommandInput): string;
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

    const authenticateAndConnect = async () => {
      const url = new URL(window.location.href);
      const token = url.searchParams.get("token");
      if (token) {
        url.searchParams.delete("token");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

        try {
          const response = await fetch("/api/auth/exchange", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (!response.ok) throw new Error("Authentication failed");
        } catch {
          if (mounted) setState((current) => ({ ...current, lastError: "Authentication failed." }));
          return;
        }
      }
      connect();
    };

    void authenticateAndConnect();

    return () => {
      mounted = false;
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
    };
  }, []);

  const send = (input: ClientCommandInput): string => {
    const commandId = crypto.randomUUID();
    const parsed = ClientCommandSchema.safeParse({
      ...input,
      protocolVersion: PROTOCOL_VERSION,
      commandId,
    });

    if (!parsed.success) {
      setState((current) => ({ ...current, lastError: "Command is invalid." }));
      return commandId;
    }

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setState((current) => ({ ...current, lastError: "Agent connection is not open." }));
      return commandId;
    }

    socket.send(JSON.stringify(parsed.data));
    return commandId;
  };

  return { state, send };
}
