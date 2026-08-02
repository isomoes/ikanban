import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./app.js";
import type { AgentConnection } from "./agent/use-agent-connection.js";

beforeEach(() => window.history.replaceState({ view: "session" }, "", "/L3dvcms/s1"));
afterEach(cleanup);

function connection(overrides: Partial<AgentConnection["state"]> = {}, send = vi.fn(() => "command-1")): AgentConnection {
  return {
    send,
    openWorkspace: vi.fn(() => "workspace-command"),
    selectSession: vi.fn(() => "session-command"),
    newSession: vi.fn(() => "new-session-command"),
    archiveSession: vi.fn(() => "archive-session-command"),
    browseDirectories: vi.fn(async (path) => ({ path, parent: null, directories: [] })),
    state: {
      connected: true,
      workspace: "/work",
      sessionId: "s1",
      status: "idle",
      models: [],
      thinkingLevels: [],
      sessions: [],
      workspaces: [],
      commands: [],
      items: [],
      lastSequence: 0,
      ...overrides,
    },
  };
}

describe("App", () => {
  it("reports whether the gateway is connected", () => {
    const { rerender } = render(<App connection={connection()} />);
    expect(screen.getByRole("banner")).toHaveTextContent("Connected");

    rerender(<App connection={connection({ connected: false })} />);
    expect(screen.getByRole("banner")).toHaveTextContent("Disconnected");
  });

  it("abbreviates POSIX and Windows workspace paths", () => {
    const { rerender } = render(<App connection={connection({ workspace: "/home/dev/project/src" })} />);
    expect(screen.getByText("…/project/src")).toHaveAttribute("title", "/home/dev/project/src");

    rerender(<App connection={connection({ workspace: "C:\\Users\\dev\\project\\src" })} />);
    expect(screen.getByText("…\\project\\src")).toHaveAttribute("title", "C:\\Users\\dev\\project\\src");
  });

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

  it("preserves a failed draft and sends it after a transient disconnect", async () => {
    const send = vi.fn<AgentConnection["send"]>(() => undefined);
    const user = userEvent.setup();
    const { rerender } = render(<App connection={connection({}, send)} />);
    const message = screen.getByLabelText("Message Pi");

    await user.type(message, "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(message).toHaveValue("Keep this draft");

    rerender(<App connection={connection({ connected: false }, send)} />);
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.keyboard("{Enter}");
    expect(send).toHaveBeenCalledTimes(1);
    expect(message).toHaveValue("Keep this draft");

    send.mockReturnValueOnce("command-2");
    rerender(<App connection={connection({}, send)} />);
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(send).toHaveBeenLastCalledWith({ type: "prompt.send", text: "Keep this draft" });
    expect(message).toHaveValue("");
  });

  it("disables stop and retains queued text while disconnected", async () => {
    const send = vi.fn<AgentConnection["send"]>(() => undefined);
    const user = userEvent.setup();
    render(<App connection={connection({ connected: false, status: "running" }, send)} />);

    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Queue mode"), "prompt.followUp");
    const message = screen.getByLabelText("Message Pi");
    await user.type(message, "Queue after reconnect{Enter}");

    expect(send).not.toHaveBeenCalled();
    expect(message).toHaveValue("Queue after reconnect");
    expect(screen.getByLabelText("Queue mode")).toHaveValue("prompt.followUp");
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

  it("gives user and assistant messages distinct conversation treatments", () => {
    render(<App connection={connection({
      items: [
        { id: "u1", type: "message", role: "user", text: "Inspect the workspace" },
        { id: "a1", type: "message", role: "assistant", text: "I will inspect it." },
      ],
    })} />);

    expect(screen.getByText("Inspect the workspace").closest("article")).toHaveClass("user-turn");
    expect(screen.getByText("I will inspect it.").closest("article")).toHaveClass("assistant-turn");
  });

  it("uses the v0.3.1 shell and attached tray composer", () => {
    render(<App connection={connection({ model: "pi-local" })} />);

    const composer = screen.getByLabelText("Message Pi").closest("form");
    expect(composer?.querySelector(".composer-shell")).toBeInTheDocument();
    expect(composer?.querySelector(".composer-tray")).toHaveTextContent("pi-local");
    expect(screen.getByRole("button", { name: "Send" })).toHaveTextContent("");
  });

  it("renders assistant Markdown while keeping conversation structure", () => {
    render(<App connection={connection({
      items: [
        { id: "a1", type: "message", role: "assistant", text: "**System Summary**\n\n- Arch Linux" },
      ],
    })} />);

    expect(screen.getByText("System Summary").tagName).toBe("STRONG");
    expect(screen.getByText("Arch Linux").closest("li")).toHaveTextContent("Arch Linux");
  });

  it("selects sessions, models, and effort from keyboard-accessible controls", async () => {
    const send = vi.fn(() => "command-1");
    const user = userEvent.setup();
    const activeConnection = connection({
      model: "test/small",
      thinkingLevel: "medium",
      models: [
        { provider: "test", id: "small", name: "Small" },
        { provider: "test", id: "large", name: "Large" },
      ],
      thinkingLevels: ["off", "low", "medium", "high"],
      sessions: [
        { id: "s1", title: "Current session", modified: "2026-08-02T10:00:00.000Z", messageCount: 2 },
        { id: "s2", title: "Earlier session", modified: "2026-08-01T10:00:00.000Z", messageCount: 4 },
      ],
    }, send);
    render(<App connection={activeConnection} />);

    await user.click(screen.getByRole("button", { name: /model/i }));
    await user.click(screen.getByRole("option", { name: /Large/i }));
    expect(send).toHaveBeenCalledWith({ type: "model.set", provider: "test", modelId: "large" });

    await user.click(screen.getByRole("button", { name: /effort/i }));
    await user.click(screen.getByRole("option", { name: "High" }));
    expect(send).toHaveBeenCalledWith({ type: "thinking.set", level: "high" });

    await user.click(screen.getByRole("button", { name: "Session: Current session" }));
    await user.click(screen.getByRole("option", { name: /Earlier session/i }));
    expect(activeConnection.selectSession).toHaveBeenCalledWith("/work", "s2");
  });

  it("starts on a homepage that separates progress and idle sessions", async () => {
    window.history.replaceState({ view: "session" }, "", "/");
    const user = userEvent.setup();
    const activeConnection = connection({
      workspace: "/work/one",
      sessionId: "s1",
      workspaces: [
        {
          path: "/work/one",
          name: "one",
          sessions: [
            { id: "s1", title: "Current", modified: "2026-08-02T10:00:00.000Z", messageCount: 2, status: "idle" },
            { id: "s2", title: "Background task", modified: "2026-08-02T09:00:00.000Z", messageCount: 3, status: "running" },
          ],
        },
        {
          path: "/work/two",
          name: "two",
          sessions: [{ id: "s3", title: "Second project", modified: "2026-08-01T10:00:00.000Z", messageCount: 1, status: "idle" }],
        },
      ],
    });
    render(<App connection={activeConnection} />);

    expect(screen.getByRole("heading", { name: "Ikanban" })).toBeInTheDocument();
    expect(screen.getByText("Live session activity grouped into Progress and Idle.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "iKanban on GitHub" })).toHaveAttribute("href", "https://github.com/isomoes/ikanban");
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Progress" })).toHaveTextContent("Background task");
    expect(screen.getByRole("region", { name: "Idle" })).toHaveTextContent("Current");
    expect(screen.getByRole("region", { name: "Idle" })).toHaveTextContent("Second project");
    expect(screen.queryByRole("navigation", { name: "Workspaces" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open session: Second project" }));
    expect(activeConnection.selectSession).toHaveBeenCalledWith("/work/two", "s3");
    expect(window.location.pathname).toBe("/L3dvcmsvdHdv/s3");
    expect(screen.getByLabelText("Message Pi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.getByRole("heading", { name: "Ikanban" })).toBeInTheDocument();
  });

  it("archives a session from the homepage", async () => {
    window.history.replaceState({}, "", "/");
    const user = userEvent.setup();
    const activeConnection = connection({
      workspaces: [{
        path: "/work",
        name: "work",
        sessions: [{ id: "s1", title: "Finished task", modified: "2026-08-02T10:00:00.000Z", messageCount: 2, status: "idle" }],
      }],
    });
    render(<App connection={activeConnection} />);

    await user.click(screen.getByRole("button", { name: "Archive: Finished task" }));

    expect(activeConnection.archiveSession).toHaveBeenCalledWith("/work", "s1");
  });

  it("browses the host filesystem before opening a workspace", async () => {
    window.history.replaceState({}, "", "/");
    const user = userEvent.setup();
    const activeConnection = connection();
    activeConnection.browseDirectories = vi.fn(async (path) => path === "/work"
      ? { path, parent: "/", directories: [{ name: "project", path: "/work/project" }] }
      : { path, parent: "/work", directories: [] });
    render(<App connection={activeConnection} />);

    await user.click(screen.getAllByRole("button", { name: "Open workspace" }).at(-1)!);
    expect(await screen.findByRole("dialog", { name: "Open workspace" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "project" }));
    await user.click(await screen.findByRole("button", { name: "Open /work/project" }));

    expect(activeConnection.browseDirectories).toHaveBeenCalledWith("/work/project");
    expect(activeConnection.openWorkspace).toHaveBeenCalledWith("/work/project");
  });

  it("discovers slash skills and invokes the selected command", async () => {
    const send = vi.fn(() => "command-1");
    const user = userEvent.setup();
    render(<App connection={connection({
      commands: [{ name: "skill:review", description: "Review current changes", source: "skill" }],
    }, send)} />);

    const message = screen.getByLabelText("Message Pi");
    await user.type(message, "/rev");
    expect(screen.getByRole("listbox", { name: "Commands" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /skill:review/i })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(message).toHaveValue("/skill:review ");
    await user.keyboard("{Enter}");
    expect(send).toHaveBeenCalledWith({ type: "prompt.send", text: "/skill:review " });
  });

  it("scrolls the active slash command into view during keyboard navigation", async () => {
    const user = userEvent.setup();
    const scrolled: Element[] = [];
    const original = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value(this: Element) { scrolled.push(this); },
    });

    try {
      render(<App connection={connection({
        commands: Array.from({ length: 12 }, (_, index) => ({
          name: `command-${index}`,
          description: `Command ${index}`,
          source: "prompt" as const,
        })),
      })} />);

      await user.type(screen.getByLabelText("Message Pi"), "/");
      scrolled.length = 0;
      await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");

      const active = screen.getAllByRole("option").find((option) => option.getAttribute("aria-selected") === "true");
      await waitFor(() => expect(scrolled.at(-1)).toBe(active));
    } finally {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: original });
      } else {
        delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
      }
    }
  });

  it("focuses the composer from typing and supports prompt history and abort shortcuts", async () => {
    const send = vi.fn(() => "command-1");
    const user = userEvent.setup();
    const { rerender } = render(<App connection={connection({}, send)} />);

    await user.keyboard("Inspect files{Enter}");
    expect(send).toHaveBeenCalledWith({ type: "prompt.send", text: "Inspect files" });
    await user.keyboard("{ArrowUp}");
    expect(screen.getByLabelText("Message Pi")).toHaveValue("Inspect files");

    rerender(<App connection={connection({ status: "running" }, send)} />);
    await user.clear(screen.getByLabelText("Message Pi"));
    await user.keyboard("{Control>}c{/Control}");
    expect(send).toHaveBeenCalledWith({ type: "run.abort" });
  });
});
