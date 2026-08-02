import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app.js";
import type { AgentConnection } from "./agent/use-agent-connection.js";

afterEach(cleanup);

function connection(overrides: Partial<AgentConnection["state"]> = {}, send = vi.fn(() => "command-1")): AgentConnection {
  return {
    send,
    state: {
      connected: true,
      workspace: "/work",
      sessionId: "s1",
      status: "idle",
      items: [],
      lastSequence: 0,
      ...overrides,
    },
  };
}

describe("App", () => {
  it("submits a prompt and exposes stop while running", async () => {
    const send = vi.fn(() => "command-1");
    const user = userEvent.setup();
    const { rerender } = render(<App connection={connection({}, send)} />);
    const message = screen.getByLabelText("Message Pi");
    await user.type(message, "List files");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(send).toHaveBeenCalledWith({ type: "prompt.send", text: "List files" });
    expect(message).toHaveValue("");

    rerender(<App connection={connection({ status: "running", lastSequence: 1 }, send)} />);
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(send).toHaveBeenCalledWith({ type: "run.abort" });
  });

  it("queues steering and follow-up prompts while running", async () => {
    const send = vi.fn(() => "command-1");
    const user = userEvent.setup();
    render(<App connection={connection({ status: "running" }, send)} />);

    await user.selectOptions(screen.getByLabelText("Queue mode"), "prompt.followUp");
    await user.type(screen.getByLabelText("Message Pi"), "Check tests");
    await user.keyboard("{Enter}");

    expect(send).toHaveBeenCalledWith({ type: "prompt.followUp", text: "Check tests" });
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "prompt.send" }));
  });

  it("keeps a newline for Shift+Enter and blocks blank submissions", async () => {
    const send = vi.fn(() => "command-1");
    const user = userEvent.setup();
    render(<App connection={connection({}, send)} />);

    const message = screen.getByLabelText("Message Pi");
    await user.type(message, "First{Shift>}{Enter}{/Shift}Second");
    expect(message).toHaveValue("First\nSecond");
    expect(send).not.toHaveBeenCalled();

    await user.clear(message);
    await user.type(message, "   ");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("renders tool output and errors accessibly", () => {
    render(<App connection={connection({
      model: "pi-local",
      items: [
        { id: "a1", type: "message", role: "assistant", text: "Hello\nthere" },
        { id: "t1", type: "tool", toolName: "read", status: "succeeded", output: "package.json" },
        { id: "e1", type: "error", message: "Something failed" },
      ],
    })} />);

    expect(screen.getByText((_, element) => element?.classList.contains("assistant-text") ?? false)).toHaveTextContent("Hello there");
    expect(screen.getByText(/read/i).closest("details")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
    expect(screen.getByText("pi-local")).toBeInTheDocument();
  });
});
