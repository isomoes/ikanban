import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ArchiveIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  BrainIcon,
  CaretDownIcon,
  ChatCircleIcon,
  CpuIcon,
  FolderIcon,
  HouseIcon,
  LightningIcon,
  MinusIcon,
  PlusIcon,
  StopIcon,
  TerminalWindowIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { SessionOption, WorkspaceOption } from "@pi-web/protocol";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useAgentConnection,
  type AgentConnection,
  type ClientCommandInput,
  type DirectoryListing,
} from "./agent/use-agent-connection.js";

interface AppProps {
  connection?: AgentConnection;
}

type QueueMode = "prompt.steer" | "prompt.followUp";
type Menu = "sessions" | "models" | "effort";

interface CommandChoice {
  name: string;
  description: string;
  source: "builtin" | "extension" | "prompt" | "skill";
  action?: Menu | "new";
}

const BUILTIN_COMMANDS: CommandChoice[] = [
  { name: "new", description: "Start a new session", source: "builtin", action: "new" },
  { name: "sessions", description: "Open a previous session", source: "builtin", action: "sessions" },
  { name: "model", description: "Choose the active model", source: "builtin", action: "models" },
  { name: "effort", description: "Set the reasoning effort", source: "builtin", action: "effort" },
];

function abbreviateWorkspace(workspace: string): string {
  if (!workspace) return "No workspace";
  const parts = workspace.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return workspace;
  const separator = workspace.lastIndexOf("\\") > workspace.lastIndexOf("/") ? "\\" : "/";
  return `…${separator}${parts.slice(-2).join(separator)}`;
}

function encodeWorkspaceId(workspace: string): string {
  const bytes = new TextEncoder().encode(workspace);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeWorkspaceId(value: string): string | undefined {
  try {
    const encoded = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="));
    return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return;
  }
}

type AppView = "home" | "session";

interface BoardCard {
  workspace: WorkspaceOption;
  session: SessionOption;
}

function KanbanMark() {
  return (
    <svg className="kanban-mark" viewBox="0 0 512 512" fill="none" aria-hidden="true">
      <rect x="96" y="120" width="88" height="112" rx="16" className="mark-strong" />
      <rect x="96" y="248" width="88" height="144" rx="16" className="mark-weak" />
      <rect x="212" y="120" width="88" height="176" rx="16" className="mark-weak" />
      <rect x="212" y="312" width="88" height="80" rx="16" className="mark-strong" />
      <rect x="328" y="120" width="88" height="80" rx="16" className="mark-strong" />
      <rect x="328" y="216" width="88" height="112" rx="16" className="mark-weak" />
      <rect x="328" y="344" width="88" height="48" rx="16" className="mark-strong" />
    </svg>
  );
}

function workspaceTail(workspace: string): string {
  const parts = workspace.split(/[\\/]/).filter(Boolean);
  return parts.slice(-2).join(workspace.includes("\\") ? "\\" : "/") || workspace;
}

function sessionFromLocation(): { workspace: string; sessionId: string } | undefined {
  const [workspaceId, sessionId, extra] = window.location.pathname.split("/").filter(Boolean);
  if (!workspaceId || !sessionId || extra) return;
  const workspace = decodeWorkspaceId(decodeURIComponent(workspaceId));
  return workspace ? { workspace, sessionId: decodeURIComponent(sessionId) } : undefined;
}

function viewFromLocation(): AppView {
  return sessionFromLocation() ? "session" : "home";
}

function relativeTime(value: string): string {
  const elapsed = Date.parse(value) - Date.now();
  const absolute = Math.abs(elapsed);
  const [amount, unit] = absolute < 3_600_000
    ? [Math.round(elapsed / 60_000), "minute" as const]
    : absolute < 86_400_000
      ? [Math.round(elapsed / 3_600_000), "hour" as const]
      : [Math.round(elapsed / 86_400_000), "day" as const];
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(amount, unit);
}

function SessionBoard({
  workspaces,
  onOpen,
  onArchive,
  onOpenWorkspace,
  connected,
}: {
  workspaces: WorkspaceOption[];
  onOpen(card: BoardCard): void;
  onArchive(card: BoardCard): void;
  onOpenWorkspace(): void;
  connected: boolean;
}) {
  const cards = workspaces.flatMap((workspace) => workspace.sessions.map((session) => ({ workspace, session })))
    .sort((left, right) => Date.parse(right.session.modified) - Date.parse(left.session.modified));
  const progress = cards.filter(({ session }) => session.status === "running" || session.status === "replacing");
  const idle = cards.filter(({ session }) => session.status !== "running" && session.status !== "replacing");

  const column = (title: "Progress" | "Idle", entries: BoardCard[]) => (
    <section className={`board-column board-${title.toLowerCase()}`} aria-label={title}>
      <div className="board-column-heading">
        <span className="board-column-icon" aria-hidden="true">
          {title === "Progress" ? <BrainIcon size={15} /> : <MinusIcon size={15} />}
        </span>
        <h2>{title}</h2>
        <span className="board-count">{entries.length}</span>
      </div>
      <div className="board-cards">
        {entries.map((card) => (
          <article className="board-card" key={`${card.workspace.path}:${card.session.id}`}>
            <button
              type="button"
              className="board-card-open"
              aria-label={`Open session: ${card.session.title}`}
              onClick={() => onOpen(card)}
            >
              <strong>{card.session.title}</strong>
              <span>
                <span title={card.workspace.path}>{workspaceTail(card.workspace.path)}</span>
                <span>{relativeTime(card.session.modified)} <ArrowRightIcon size={13} aria-hidden="true" /></span>
              </span>
            </button>
            <button
              type="button"
              className="board-card-archive"
              aria-label={`Archive: ${card.session.title}`}
              title="Archive"
              onClick={() => onArchive(card)}
            >
              <ArchiveIcon size={15} aria-hidden="true" />
            </button>
          </article>
        ))}
        {entries.length === 0 && (
          <p className="board-empty">
            {title === "Progress" ? "No sessions are actively running." : "No idle sessions yet."}
          </p>
        )}
      </div>
    </section>
  );

  return (
    <main className="session-board">
      <div className="board-header">
        <div className="board-brand">
          <a
            className="board-logo"
            href="https://github.com/isomoes/ikanban"
            aria-label="iKanban on GitHub"
            target="_blank"
            rel="noreferrer"
          >
            <KanbanMark />
          </a>
          <div>
            <h1>Ikanban</h1>
            <p>Live session activity grouped into Progress and Idle.</p>
          </div>
        </div>
        <div className="board-actions">
          <button type="button" className="board-open-workspace" aria-label="Open workspace" onClick={onOpenWorkspace}>
            <FolderIcon size={16} aria-hidden="true" />
            <span>Open workspace</span>
          </button>
          <div className="board-server-status" title={connected ? "Connected" : "Disconnected"}>
            <span className={`connection-light ${connected ? "is-connected" : ""}`} aria-hidden="true" />
            <span>Pi Agent</span>
            <span className="visually-hidden">{connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      </div>
      <div className="board-columns">
        {column("Progress", progress)}
        {column("Idle", idle)}
      </div>
    </main>
  );
}

function AppShell({ connection }: { connection: AgentConnection }) {
  const { state, send } = connection;
  const [text, setText] = useState("");
  const [queueMode, setQueueMode] = useState<QueueMode>("prompt.steer");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [activeOption, setActiveOption] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [view, setView] = useState<AppView>(viewFromLocation);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerListing, setPickerListing] = useState<DirectoryListing | null>(null);
  const [pickerError, setPickerError] = useState<string>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const running = state.status === "running" || state.status === "replacing";
  const canSubmit = text.trim().length > 0;
  const slashMatch = text.match(/^\/(\S*)$/);
  const slashQuery = slashMatch?.[1]?.toLowerCase();
  const commands: CommandChoice[] = [
    ...BUILTIN_COMMANDS,
    ...state.commands.map((command) => ({ ...command })),
  ];
  const slashCommands = slashQuery === undefined
    ? []
    : commands.filter((command) =>
      command.name.toLowerCase().includes(slashQuery)
      || command.description.toLowerCase().includes(slashQuery)
    );
  const currentSession = state.sessions.find((session) => session.id === state.sessionId);
  const workspaces = state.workspaces.length > 0
    ? state.workspaces
    : state.workspace
      ? [{ path: state.workspace, name: state.workspace.split(/[\\/]/).filter(Boolean).at(-1) ?? state.workspace, sessions: state.sessions }]
      : [];
  const activeWorkspace = workspaces.find((workspace) => workspace.path === state.workspace)
    ?? { path: state.workspace, name: abbreviateWorkspace(state.workspace), sessions: state.sessions };

  const openSession = (card: BoardCard) => {
    connection.selectSession(card.workspace.path, card.session.id);
    window.history.pushState(
      { view: "session" },
      "",
      `/${encodeWorkspaceId(card.workspace.path)}/${encodeURIComponent(card.session.id)}`,
    );
    setView("session");
  };

  const showHome = () => {
    window.history.pushState({}, "", "/");
    setView("home");
    setMenu(null);
  };

  const startNewSession = () => {
    if (!connection.newSession(state.workspace)) return;
    window.history.replaceState({ view: "session", pendingNew: true }, "", window.location.pathname);
  };

  const browseWorkspace = async (path: string) => {
    setPickerOpen(true);
    setPickerError(undefined);
    try {
      setPickerListing(await connection.browseDirectories(path));
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "Unable to browse directory.");
    }
  };

  const openMenu = (next: Menu) => {
    setMenu(next);
    setActiveOption(0);
  };

  useEffect(() => {
    const onPopState = () => {
      const next = viewFromLocation();
      setView(next);
      if (next === "session") {
        const target = sessionFromLocation();
        if (target) connection.selectSession(target.workspace, target.sessionId);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [connection]);

  useEffect(() => {
    if (view !== "session") return;
    const target = sessionFromLocation();
    if (target && (target.workspace !== state.workspace || target.sessionId !== state.sessionId)) {
      connection.selectSession(target.workspace, target.sessionId);
    }
  }, []);

  useEffect(() => {
    if (view !== "session" || !window.history.state?.pendingNew || !state.workspace || !state.sessionId) return;
    window.history.replaceState(
      { view: "session" },
      "",
      `/${encodeWorkspaceId(state.workspace)}/${encodeURIComponent(state.sessionId)}`,
    );
  }, [state.sessionId, state.workspace, view]);

  useEffect(() => {
    if (!menu) return;
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>("[role=option]")?.focus());
  }, [menu]);

  useEffect(() => {
    if (slashCommands.length === 0) return;
    const frame = requestAnimationFrame(() => {
      const option = slashMenuRef.current
        ?.querySelector<HTMLElement>(`[data-command-index="${activeOption}"]`);
      option?.scrollIntoView?.({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeOption, slashCommands.length, slashQuery]);

  const submitPrompt = () => {
    if (!state.connected || !canSubmit) return;
    const command: ClientCommandInput = running
      ? { type: queueMode, text }
      : { type: "prompt.send", text };
    if (send(command)) {
      setHistory((current) => current.at(-1) === text ? current : [...current, text]);
      setHistoryIndex(-1);
      setText("");
    }
  };

  const chooseCommand = (command: CommandChoice) => {
    if (command.action === "new") {
      startNewSession();
      setText("");
    } else if (command.action) {
      openMenu(command.action);
      setText("");
    } else {
      setText(`/${command.name} `);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    setActiveOption(0);
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
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "c" && running && !text) {
      event.preventDefault();
      if (state.connected) send({ type: "run.abort" });
      return;
    }
    if (event.key === "Escape") {
      if (menu || slashCommands.length > 0) {
        setMenu(null);
        setText((current) => current === "/" ? "" : current);
      } else {
        event.currentTarget.blur();
      }
      event.preventDefault();
      return;
    }
    if (slashCommands.length > 0 && ["ArrowDown", "ArrowUp", "Tab", "Enter"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Enter" || event.key === "Tab") {
        chooseCommand(slashCommands[activeOption] ?? slashCommands[0]!);
      } else {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setActiveOption((current) => (current + direction + slashCommands.length) % slashCommands.length);
      }
      return;
    }
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const atBoundary = event.key === "ArrowUp"
        ? event.currentTarget.selectionStart === 0
        : event.currentTarget.selectionEnd === text.length;
      if (atBoundary && history.length > 0) {
        event.preventDefault();
        const nextIndex = event.key === "ArrowUp"
          ? Math.min(history.length - 1, historyIndex + 1)
          : Math.max(-1, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setText(nextIndex === -1 ? "" : history[history.length - 1 - nextIndex]!);
        return;
      }
    }
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submitPrompt();
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (view !== "session") return;
      const target = event.target;
      const inControl = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
      const modifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (modifier && !event.altKey && key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (modifier && !event.altKey && key === "m") {
        event.preventDefault();
        openMenu("models");
        return;
      }
      if (modifier && event.shiftKey && !event.altKey && key === "e") {
        event.preventDefault();
        openMenu("effort");
        return;
      }
      if (modifier && !event.altKey && key === "o") {
        event.preventDefault();
        openMenu("sessions");
        return;
      }
      if (inControl || modifier || event.altKey || event.key.length !== 1) return;

      event.preventDefault();
      inputRef.current?.focus();
      setText((current) => current + event.key);
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [view]);

  const closeMenu = () => {
    setMenu(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role=option]"));
    const current = options.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || options.length === 0) return;
    event.preventDefault();
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  };

  return (
    <div className={`app-frame ${view === "home" ? "is-home" : ""}`}>
      {view === "session" && <header className="app-header">
        <div className="brand-lockup">
          {view === "session" && (
            <button type="button" className="home-button" aria-label="Home" onClick={showHome}>
              <HouseIcon size={16} aria-hidden="true" />
            </button>
          )}
          <span className="brand-mark" aria-hidden="true">π</span>
          <strong>Pi Agent</strong>
        </div>

        <div className="header-context">
          {view === "session" && (
            <>
              <button
                type="button"
                className="session-trigger"
                aria-label={`Session: ${currentSession?.title ?? "New session"}`}
                onClick={() => openMenu("sessions")}
                disabled={running}
              >
                <ChatCircleIcon size={14} aria-hidden="true" />
                <span>{currentSession?.title ?? "New session"}</span>
                <CaretDownIcon size={11} aria-hidden="true" />
              </button>
              <span className="header-workspace" title={state.workspace}>{abbreviateWorkspace(state.workspace)}</span>
            </>
          )}
          <div className="connection-status" title={state.connected ? "Agent connected" : "Agent disconnected"}>
            <span className={`connection-light ${state.connected ? "is-connected" : ""}`} aria-hidden="true" />
            <span>{state.connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>
      </header>}

      {view === "home" ? (
        <SessionBoard
          workspaces={workspaces}
          onOpen={openSession}
          onArchive={(card) => connection.archiveSession(card.workspace.path, card.session.id)}
          onOpenWorkspace={() => void browseWorkspace(state.workspace || "/")}
          connected={state.connected}
        />
      ) : (
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
          {menu && (
            <div
              ref={menuRef}
              className="choice-popover"
              role="listbox"
              aria-label={menu === "models" ? "Models" : menu === "effort" ? "Effort levels" : "Sessions"}
              onKeyDown={handleMenuKeyDown}
            >
              <div className="popover-heading">
                <span>{menu === "models" ? "Choose model" : menu === "effort" ? "Reasoning effort" : "Open session"}</span>
                <kbd>Esc</kbd>
              </div>
              {menu === "models" && state.models.map((model) => (
                <button
                  key={`${model.provider}/${model.id}`}
                  type="button"
                  role="option"
                  aria-selected={state.model === `${model.provider}/${model.id}`}
                  onClick={() => {
                    send({ type: "model.set", provider: model.provider, modelId: model.id });
                    closeMenu();
                  }}
                >
                  <span><strong>{model.name}</strong><small>{model.provider}/{model.id}</small></span>
                  {state.model === `${model.provider}/${model.id}` && <span className="selected-mark">Current</span>}
                </button>
              ))}
              {menu === "effort" && state.thinkingLevels.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="option"
                  aria-selected={state.thinkingLevel === level}
                  onClick={() => {
                    send({ type: "thinking.set", level: level as Extract<ClientCommandInput, { type: "thinking.set" }>["level"] });
                    closeMenu();
                  }}
                >
                  <span><strong>{level[0]?.toUpperCase()}{level.slice(1)}</strong></span>
                  {state.thinkingLevel === level && <span className="selected-mark">Current</span>}
                </button>
              ))}
              {menu === "sessions" && (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    startNewSession();
                    closeMenu();
                  }}
                >
                  <span className="new-session-option"><PlusIcon size={15} aria-hidden="true" /><strong>New conversation</strong></span>
                  <small>/new</small>
                </button>
              )}
              {menu === "sessions" && state.sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  role="option"
                  aria-selected={state.sessionId === session.id}
                  onClick={() => {
                    if (state.sessionId !== session.id) openSession({ workspace: activeWorkspace, session });
                    closeMenu();
                  }}
                >
                  <span><strong>{session.title}</strong><small>{session.messageCount} messages</small></span>
                  <small>{new Date(session.modified).toLocaleDateString()}</small>
                </button>
              ))}
              {((menu === "models" && state.models.length === 0) || (menu === "effort" && state.thinkingLevels.length === 0)) && (
                <p className="popover-empty">No options available.</p>
              )}
            </div>
          )}
          {slashCommands.length > 0 && (
            <div ref={slashMenuRef} className="choice-popover command-popover" role="listbox" aria-label="Commands">
              {slashCommands.map((command, index) => (
                <button
                  key={`${command.source}:${command.name}`}
                  data-command-index={index}
                  type="button"
                  role="option"
                  aria-selected={index === activeOption}
                  onMouseEnter={() => setActiveOption(index)}
                  onClick={() => chooseCommand(command)}
                >
                  <span><strong>/{command.name}</strong><small>{command.description}</small></span>
                  <span className="command-source">{command.source}</span>
                </button>
              ))}
            </div>
          )}
          <form className="composer" onSubmit={handleSubmit}>
            <div className="composer-shell">
              <label className="visually-hidden" htmlFor="message">Message Pi</label>
              <textarea
                ref={inputRef}
                id="message"
                rows={2}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setActiveOption(0);
                  setHistoryIndex(-1);
                }}
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
                <button
                  type="button"
                  className="tray-selector"
                  aria-label={`Model: ${state.model ?? "Select model"}`}
                  onClick={() => openMenu("models")}
                  disabled={running}
                  title="Choose model (Ctrl/Cmd+M)"
                >
                  <CpuIcon size={15} weight="regular" aria-hidden="true" />
                  <span className="tray-model">{state.model ?? "Select model"}</span>
                  <CaretDownIcon size={10} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="tray-selector"
                  aria-label={`Effort: ${state.thinkingLevel ?? "Default"}`}
                  onClick={() => openMenu("effort")}
                  disabled={running}
                  title="Reasoning effort (Ctrl/Cmd+Shift+E)"
                >
                  <LightningIcon size={14} weight="regular" aria-hidden="true" />
                  <span>{state.thinkingLevel ?? "default"}</span>
                  <CaretDownIcon size={10} aria-hidden="true" />
                </button>
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
      )}

      {pickerOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPickerOpen(false);
        }}>
          <section className="directory-dialog" role="dialog" aria-modal="true" aria-labelledby="directory-dialog-title">
            <header>
              <div>
                <h2 id="directory-dialog-title">Open workspace</h2>
                <p>{pickerListing?.path ?? "Loading directories..."}</p>
              </div>
              <button type="button" aria-label="Close directory picker" onClick={() => setPickerOpen(false)}>
                <XIcon size={16} aria-hidden="true" />
              </button>
            </header>
            {pickerError && <p className="picker-error" role="alert">{pickerError}</p>}
            <div className="directory-list">
              {pickerListing?.parent && (
                <button type="button" onClick={() => void browseWorkspace(pickerListing.parent!)}>
                  <span className="directory-up">..</span>
                  <span>{pickerListing.parent}</span>
                </button>
              )}
              {pickerListing?.directories.map((directory) => (
                <button key={directory.path} type="button" onClick={() => void browseWorkspace(directory.path)}>
                  <FolderIcon size={16} aria-hidden="true" />
                  <span>{directory.name}</span>
                </button>
              ))}
              {pickerListing && pickerListing.directories.length === 0 && <p>No subdirectories.</p>}
            </div>
            <footer>
              <button type="button" className="dialog-cancel" onClick={() => setPickerOpen(false)}>Cancel</button>
              <button
                type="button"
                className="dialog-confirm"
                aria-label={`Open ${pickerListing?.path ?? "workspace"}`}
                disabled={!pickerListing}
                onClick={() => {
                  if (!pickerListing) return;
                  connection.openWorkspace(pickerListing.path);
                  setPickerOpen(false);
                }}
              >
                Open folder
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function ConnectedApp() {
  return <AppShell connection={useAgentConnection()} />;
}

export function App({ connection }: AppProps) {
  return connection ? <AppShell connection={connection} /> : <ConnectedApp />;
}
