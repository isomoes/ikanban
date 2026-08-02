import { useState, type FormEvent, type KeyboardEvent } from "react";
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
  const parts = workspace.split("/").filter(Boolean);
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : workspace;
}

function AppShell({ connection }: { connection: AgentConnection }) {
  const { state, send } = connection;
  const [text, setText] = useState("");
  const [queueMode, setQueueMode] = useState<QueueMode>("prompt.steer");
  const running = state.status === "running" || state.status === "replacing";
  const canSubmit = text.trim().length > 0;

  const submitPrompt = () => {
    if (!canSubmit) return;
    const command: ClientCommandInput = running
      ? { type: queueMode, text }
      : { type: "prompt.send", text };
    send(command);
    setText("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (running) {
      send({ type: "run.abort" });
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
      <aside className="status-rail" aria-label="Agent status">
        <span className={`connection-light ${state.connected ? "is-connected" : ""}`} aria-hidden="true" />
        <span className="rail-label">{state.connected ? "Online" : "Offline"}</span>
      </aside>

      <div className="app-body">
        <header className="app-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">π</span>
            <div>
              <strong>Pi Workshop</strong>
              <span>Local agent console</span>
            </div>
          </div>
          <dl className="runtime-meta">
            <div>
              <dt>Model</dt>
              <dd>{state.model ?? "Awaiting runtime"}</dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd title={state.workspace}>{abbreviateWorkspace(state.workspace)}</dd>
            </div>
          </dl>
        </header>

        <main className="transcript" aria-label="Agent transcript">
          {state.items.length === 0 ? (
            <section className="empty-state">
              <span className="empty-index">01</span>
              <h1>Start with the work in front of you.</h1>
              <p>Ask Pi to inspect, explain, or change this workspace. Your local agent activity will appear here.</p>
            </section>
          ) : (
            <ol className="transcript-list">
              {state.items.map((item) => (
                <li key={item.id} className={`transcript-item item-${item.type}`}>
                  {item.type === "message" && (
                    <article>
                      <span className="item-label">{item.role === "assistant" ? "Pi" : "You"}</span>
                      <p className={item.role === "assistant" ? "assistant-text" : "user-text"}>{item.text}</p>
                    </article>
                  )}
                  {item.type === "tool" && (
                    <details>
                      <summary>
                        <span>{item.toolName}</span>
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
            <label htmlFor="message">Message Pi</label>
            <textarea
              id="message"
              rows={2}
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={running ? "Add direction to the active run" : "Describe the next task"}
            />
            <div className="composer-actions">
              {running ? (
                <label className="queue-control">
                  <span>Queue mode</span>
                  <select value={queueMode} onChange={(event) => setQueueMode(event.target.value as QueueMode)} aria-label="Queue mode">
                    <option value="prompt.steer">Steer now</option>
                    <option value="prompt.followUp">Follow up</option>
                  </select>
                </label>
              ) : <span className="key-hint">Enter to send · Shift+Enter for newline</span>}
              <button type="submit" disabled={!running && !canSubmit}>{running ? "Stop" : "Send"}</button>
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
