import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAgentConnection } from "./use-agent-connection.js";

class FakeWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  send = vi.fn();

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    FakeWebSocket.instances.push(this);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  emitMessage(data: string) {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

beforeEach(() => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useAgentConnection", () => {
  it("exchanges a query token once before opening a socket in Strict Mode", async () => {
    window.history.replaceState({}, "", "/strict-success?token=secret&view=agent");
    let finishExchange!: (response: Response) => void;
    const exchange = new Promise<Response>((resolve) => {
      finishExchange = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>(() => exchange);
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useAgentConnection(), { reactStrictMode: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(window.location.search).toBe("?view=agent");

    finishExchange({ ok: true } as Response);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
  });

  it("surfaces a failed exchange without creating or retrying a socket", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/strict-failure?token=bad");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => ({ ok: false } as Response)));

    const { result } = renderHook(() => useAgentConnection(), { reactStrictMode: true });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.state.lastError).toBe("Authentication failed.");
    expect(FakeWebSocket.instances).toHaveLength(0);

    act(() => vi.advanceTimersByTime(5_000));
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("rejects invalid server frames", async () => {
    window.history.replaceState({}, "", "/invalid-frame");
    const { result } = renderHook(() => useAgentConnection());
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

    act(() => FakeWebSocket.instances[0]?.emitMessage(JSON.stringify({ type: "unknown" })));

    expect(result.current.state.lastError).toBe("Server sent an invalid message.");
  });

  it("reports sends attempted before the socket opens", async () => {
    window.history.replaceState({}, "", "/closed-socket");
    const { result } = renderHook(() => useAgentConnection());
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

    let commandId: string | undefined;
    act(() => {
      commandId = result.current.send({ type: "run.abort" });
    });

    expect(commandId).toBeUndefined();
    expect(result.current.state.lastError).toBe("Agent connection is not open.");
    expect(FakeWebSocket.instances[0]?.send).not.toHaveBeenCalled();
  });

  it("only returns a command ID while the socket is open", async () => {
    window.history.replaceState({}, "", "/transient-disconnect");
    const { result } = renderHook(() => useAgentConnection());
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = FakeWebSocket.instances[0]!;

    act(() => socket.open());
    let deliveredId: string | undefined;
    act(() => {
      deliveredId = result.current.send({ type: "prompt.send", text: "Keep this" });
    });

    expect(deliveredId).toEqual(expect.any(String));
    expect(socket.send).toHaveBeenCalledTimes(1);

    act(() => socket.close());
    let disconnectedId: string | undefined;
    act(() => {
      disconnectedId = result.current.send({ type: "prompt.send", text: "Still here" });
    });

    expect(result.current.state.connected).toBe(false);
    expect(disconnectedId).toBeUndefined();
    expect(socket.send).toHaveBeenCalledTimes(1);
  });
});
