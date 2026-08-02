import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowUpIcon,
  CpuIcon,
  FolderIcon,
  StopIcon,
  TerminalWindowIcon,
} from "@phosphor-icons/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useAgentConnection,
  type AgentConnection,
  type ClientCommandInput,
} from "./agent/use-agent-connection.js";

interface AppProps {
  connection?: AgentConnection;
}

type QueueMode = "prompt.steer" | "prompt.followUp";

function abbreviateWorkspace(workspace: string): string {
  if (!workspace) return "No workspace";
  const parts = workspace.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return workspace;
  const separator = workspace.lastIndexOf("\\") > workspace.lastIndexOf("/") ? "\\" : "/";
  return `…${separator}${parts.slice(-2).join(separator)}`;
}

function AppShell({ connection }: { connection: AgentConnection }) {
  const { state, send } = connection;
  const [text, setText] = useState("");
  const [queueMode, setQueueMode] = useState<QueueMode>("prompt.steer");
  const running = state.status === "running" || state.status === "replacing";
  const canSubmit = text.trim().length > 0;

  const submitPrompt = () => {
    if (!state.connected || !canSubmit) return;
    const command: ClientCommandInput = running
      ? { type: queueMode, text }
      : { type: "prompt.send", text };
    if (send(command)) setText("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (running) {
      if (state.connected) send({ type: "run.abort" });
      return;
    }
    submitPrompt();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submitPrompt();
  };

  return (
    <div className="app-frame">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">π</span>
          <strong>Pi Agent</strong>
        </div>

        <div className="header-context">
          <span className="header-workspace" title={state.workspace}>{abbreviateWorkspace(state.workspace)}</span>
          <div className="connection-status" title={state.connected ? "Agent connected" : "Agent disconnected"}>
            <span className={`connection-light ${state.connected ? "is-connected" : ""}`} aria-hidden="true" />
            <span>{state.connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      </header>

      <div className="app-body">
        <main className="transcript" aria-label="Agent transcript">
          {state.items.length === 0 ? (
            <section className="empty-state">
              <h1>New session</h1>
              <div className="empty-meta">
                <FolderIcon size={16} weight="regular" aria-hidden="true" />
                <span>{state.workspace || "No workspace selected"}</span>
              </div>
              <div className="empty-meta">
                <CpuIcon size={16} weight="regular" aria-hidden="true" />
                <span>{state.model ?? "Waiting for model"}</span>
              </div>
            </section>
          ) : (
            <ol className="transcript-list">
              {state.items.map((item) => (
                <li key={item.id} className={`transcript-item item-${item.type}`}>
                  {item.type === "message" && (
                    <article className={`${item.role}-turn`}>
                      <span className="visually-hidden">{item.role === "assistant" ? "Pi" : "You"}</span>
                      {item.role === "assistant" ? (
                        <div className="assistant-text">
                          <Markdown remarkPlugins={[remarkGfm]} skipHtml>{item.text}</Markdown>
                        </div>
                      ) : (
                        <p className="user-text">{item.text}</p>
                      )}
                    </article>
                  )}
                  {item.type === "tool" && (
                    <details>
                      <summary>
                        <span className="tool-name">
                          <TerminalWindowIcon size={16} weight="regular" aria-hidden="true" />
                          <span>{item.toolName}</span>
                        </span>
                        <span className={`tool-state state-${item.status}`}>{item.status}</span>
                      </summary>
                      <pre>{item.output || "No output yet."}</pre>
                    </details>
                  )}
                  {item.type === "error" && <p role="alert">{item.message}</p>}
                </li>
              ))}
            </ol>
          )}
        </main>

        <footer className="composer-wrap">
          {state.lastError && <p className="connection-error" role="alert">{state.lastError}</p>}
          <form className="composer" onSubmit={handleSubmit}>
            <div className="composer-shell">
              <label className="visually-hidden" htmlFor="message">Message Pi</label>
              <textarea
                id="message"
                rows={2}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={running ? "Add direction to the active run" : "Ask anything..."}
              />
              <div className="composer-actions">
                <button
                  type="submit"
                  aria-label={running ? "Stop" : "Send"}
                  title={running ? "Stop" : "Send"}
                  disabled={!state.connected || (!running && !canSubmit)}
                >
                  {running
                    ? <StopIcon size={16} weight="fill" aria-hidden="true" />
                    : <ArrowUpIcon size={17} weight="bold" aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div className="composer-tray">
              <div className="tray-context">
                <CpuIcon size={15} weight="regular" aria-hidden="true" />
                <span className="tray-model">{state.model ?? "Select model"}</span>
              </div>
              {running && (
                <label className="queue-control">
                  <span>Queue mode</span>
                  <select value={queueMode} onChange={(event) => setQueueMode(event.target.value as QueueMode)} aria-label="Queue mode">
                    <option value="prompt.steer">Steer now</option>
                    <option value="prompt.followUp">Follow up</option>
                  </select>
                </label>
              )}
            </div>
          </form>
        </footer>
      </div>
    </div>
  );
}

function ConnectedApp() {
  return <AppShell connection={useAgentConnection()} />;
}

export function App({ connection }: AppProps) {
  return connection ? <AppShell connection={connection} /> : <ConnectedApp />;
}
