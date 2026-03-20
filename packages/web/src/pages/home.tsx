import { createMemo, createEffect, createResource, For, Match, Switch } from "solid-js";
import { Button } from "ikanban-ui/button";
import { Logo } from "ikanban-ui/logo";
import { useLayout } from "@/context/layout";
import { useNavigate } from "@solidjs/router";
import { base64Encode } from "ikanban-utils/encode";
import { Icon } from "ikanban-ui/icon";
import { usePlatform } from "@/context/platform";
import { DateTime } from "luxon";
import { useDialog } from "ikanban-ui/context/dialog";
import { DialogSelectDirectory } from "@/components/dialog-select-directory";
import { DialogSelectServer } from "@/components/dialog-select-server";
import { useGlobalSDK } from "@/context/global-sdk";
import { useServer } from "@/context/server";
import { useGlobalSync } from "@/context/global-sync";
import { useLanguage } from "@/context/language";
import { IconButton } from "ikanban-ui/icon-button";
import type { Session } from "@opencode-ai/sdk/v2/client";
import { buildBoardColumns, trackedProjectDirectories, type BoardCard, type BoardColumn } from "./home/helpers";

const homeStyles = {
  border: { border: "1px solid var(--border-weak-base)" },
  heroIcon: {
    border: "1px solid var(--border-weak-base)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--text-interactive-base) 12%, var(--background-stronger)), var(--background-stronger))",
  },
  emptyPanel: {
    "border-color": "var(--border-weak-base)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-base-hover) 35%, var(--background-stronger)), var(--background-stronger))",
  },
  emptyIcon: {
    border: "1px solid var(--border-weak-base)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--text-interactive-base) 10%, var(--surface-inset-base)), var(--surface-inset-base))",
  },
  card: {
    border: "1px solid var(--border-weak-base)",
    background: "var(--background-base)",
  },
  emptyState: {
    "border-color": "var(--border-weak-base)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--surface-base-hover) 30%, var(--surface-inset-base)), var(--surface-inset-base))",
  },
} as const;

export default function Home() {
  const sync = useGlobalSync();
  const layout = useLayout();
  const platform = usePlatform();
  const dialog = useDialog();
  const navigate = useNavigate();
  const globalSDK = useGlobalSDK();
  const server = useServer();
  const language = useLanguage();
  const trackedProjects = createMemo(() => trackedProjectDirectories(server.projects.list()));

  const [rootSessions, { mutate: mutateRootSessions }] = createResource(
    trackedProjects,
    async (directories) => {
      const entries = await Promise.all(
        directories.map(async (directory) => {
          const result = await globalSDK.client.session.list({
            directory,
            roots: true,
          });

          const sessions = (result.data ?? []).filter(
            (session): session is Session => !!session?.id && !session.time?.archived,
          );

          return [directory, sessions] as const;
        }),
      );

      return Object.fromEntries(entries) as Record<string, Session[]>;
    },
  );

  const boardColumns = createMemo<Record<BoardColumn, BoardCard[]>>(() => {
    const sessionsByProject = rootSessions() ?? {};
    const statusesByProject = Object.fromEntries(
      trackedProjects().map((directory) => {
        const [store] = sync.child(directory);
        return [directory, store.session_status] as const;
      }),
    );

    return buildBoardColumns({
      projectDirectories: trackedProjects(),
      sessionsByProject,
      statusesByProject,
    });
  });

  createEffect(() => {
    for (const directory of trackedProjects()) {
      sync.child(directory);
    }
  });

  const serverDotClass = createMemo(() => {
    const healthy = server.healthy();
    if (healthy === true) return "bg-icon-success-base";
    if (healthy === false) return "bg-icon-critical-base";
    return "bg-border-weak-base";
  });

  function openProject(directory: string) {
    layout.projects.open(directory);
    server.projects.touch(directory);
    navigate(`/${base64Encode(directory)}`);
  }

  function openSession(directory: string, sessionID: string) {
    layout.projects.open(directory);
    server.projects.touch(directory);
    navigate(`/${base64Encode(directory)}/${sessionID}`);
  }

  async function archiveSession(directory: string, sessionID: string) {
    const [, setStore] = sync.child(directory, { bootstrap: false });
    await globalSDK.client.session.update({
      sessionID,
      time: { archived: Date.now() },
    });
    mutateRootSessions((current) => {
      if (!current?.[directory]) return current;
      return {
        ...current,
        [directory]: current[directory].filter((session) => session.id !== sessionID),
      };
    });
    setStore(
      "session",
      (sessions) => sessions.filter((session) => session.id !== sessionID),
    );
  }

  async function chooseProject() {
    function resolve(result: string | string[] | null) {
      if (Array.isArray(result)) {
        for (const directory of result) {
          openProject(directory);
        }
      } else if (result) {
        openProject(result);
      }
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog?.({
        title: language.t("command.project.open"),
        multiple: true,
      });
      resolve(result);
    } else {
      dialog.show(
        () => <DialogSelectDirectory multiple={true} onSelect={resolve} />,
        () => resolve(null),
      );
    }
  }

  return (
    <div class="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <div
              class="flex size-10 items-center justify-center rounded-2xl border shadow-xs-border-base"
              style={homeStyles.heroIcon}
            >
              <Logo class="w-6 opacity-90" />
            </div>
            <div>
              <div class="text-18-medium text-text-strong">
                {language.t("home.sessionBoard")}
              </div>
              <div class="mt-0.5 text-12-regular text-text-weak">
                {language.t("home.sessionBoard.description")}
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 self-start md:justify-end">
          <Button
            icon="folder-add-left"
            size="normal"
            class="pl-2 pr-3"
            onClick={chooseProject}
          >
            {language.t("command.project.open")}
          </Button>
          <Button
            size="normal"
            variant="ghost"
            class="pr-3 text-13-regular text-text-weak"
            onClick={() => dialog.show(() => <DialogSelectServer />)}
          >
            <div
              classList={{
                "size-2 rounded-full": true,
                [serverDotClass()]: true,
              }}
            />
            {server.name}
          </Button>
        </div>
      </div>

      <Switch>
        <Match when={trackedProjects().length > 0}>
          <div class="mt-6 flex w-full flex-col gap-6">
            <section class="flex flex-col gap-4">
              <div class="grid gap-3 lg:grid-cols-2">
                <BoardColumnView
                  title={language.t("home.sessionBoard.progress")}
                  icon="brain"
                  tone="progress"
                  cards={boardColumns().progress}
                  onOpen={openSession}
                  onArchive={archiveSession}
                  empty={language.t("home.sessionBoard.emptyProgress")}
                />
                <BoardColumnView
                  title={language.t("home.sessionBoard.idle")}
                  icon="dash"
                  tone="idle"
                  cards={boardColumns().idle}
                  onOpen={openSession}
                  onArchive={archiveSession}
                  empty={language.t("home.sessionBoard.emptyIdle")}
                />
              </div>
            </section>
          </div>
        </Match>
        <Match when={true}>
          <div
            class="mt-6 rounded-2xl border border-dashed px-6 py-10 shadow-xs-border-base"
            style={homeStyles.emptyPanel}
          >
            <div class="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
              <div
                class="flex size-12 items-center justify-center rounded-2xl border shadow-xs-border-base"
                style={homeStyles.emptyIcon}
              >
                <Icon name="folder-add-left" size="large" />
              </div>
              <div class="flex flex-col gap-1 items-center justify-center">
                <div class="text-14-medium text-text-strong">
                  {language.t("home.empty.title")}
                </div>
                <div class="text-12-regular text-text-weak">
                  {language.t("home.empty.description")}
                </div>
              </div>
              <Button class="mt-1 px-3" onClick={chooseProject}>
                {language.t("command.project.open")}
              </Button>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

function BoardColumnView(props: {
  title: string;
  icon: "brain" | "dash";
  tone: BoardColumn;
  cards: BoardCard[];
  empty: string;
  onOpen: (directory: string, sessionID: string) => void;
  onArchive: (directory: string, sessionID: string) => void | Promise<void>;
}) {
  const toneClass = () => {
    if (props.tone === "progress")
      return "bg-surface-base-hover text-icon-success-base border-border-weak-base";
    return "bg-surface-inset-base text-icon-base border-border-weak-base";
  };

  const sectionStyle = () =>
    props.tone === "progress"
      ? {
          ...homeStyles.border,
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--text-interactive-base) 8%, var(--background-stronger)), var(--background-stronger))",
        }
      : {
          ...homeStyles.border,
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--surface-inset-base) 55%, var(--background-stronger)), var(--background-stronger))",
        };

  return (
    <section class="rounded-2xl p-3 md:p-4 min-h-72 shadow-xs-border-base" style={sectionStyle()}>
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <div
            class={`size-7 rounded-full border flex items-center justify-center ${toneClass()}`}
          >
            <Icon name={props.icon} size="small" />
          </div>
          <div class="text-14-medium text-text-strong">{props.title}</div>
        </div>
        <div class="text-12-mono text-text-weak">{props.cards.length}</div>
      </div>

      <div class="mt-3 flex flex-col gap-2">
        <Switch>
          <Match when={props.cards.length > 0}>
            <For each={props.cards}>
              {(card) => (
                <div
                  class="overflow-hidden rounded-xl transition-colors"
                  style={homeStyles.card}
                >
                  <div class="flex items-start justify-between gap-3 px-3 pt-3">
                    <div class="min-w-0 flex-1 pt-1">
                      <div class="truncate text-14-medium leading-tight text-text-strong">
                        {card.session.title}
                      </div>
                    </div>
                    <IconButton
                      icon="archive"
                      variant="ghost"
                      class="size-7 rounded-md"
                      aria-label="Archive session"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void props.onArchive(card.projectDirectory, card.session.id);
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    class="flex h-auto w-full min-w-0 items-center justify-between gap-3 rounded-none border-0 bg-transparent px-3 pb-3 pt-2 text-left"
                    onClick={() =>
                      props.onOpen(card.projectDirectory, card.session.id)
                    }
                  >
                    <span class="min-w-0 flex-1 truncate text-12-regular text-text-weak">
                      {card.projectDirectory.replace(
                        /^.*?([^/\\]+(?:[/\\][^/\\]+)?)$/,
                        "$1",
                      )}
                    </span>
                    <div class="flex shrink-0 items-center gap-2 text-12-regular text-text-weak">
                      <span>{DateTime.fromMillis(card.updatedAt).toRelative()}</span>
                      <Icon
                        name="arrow-right"
                        size="small"
                        class="text-icon-weak shrink-0"
                      />
                    </div>
                  </Button>
                </div>
              )}
            </For>
          </Match>
          <Match when={true}>
            <div
              class="rounded-xl border border-dashed px-3 py-8 text-center text-12-regular text-text-weak"
              style={homeStyles.emptyState}
            >
              {props.empty}
            </div>
          </Match>
        </Switch>
      </div>
    </section>
  );
}
