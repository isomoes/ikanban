import { createMemo } from "solid-js";
import { produce } from "solid-js/store";
import { useNavigate, useParams } from "@solidjs/router";
import { useCommand, type CommandOption } from "@/context/command";
import { useDialog } from "@/ui/context/dialog";
import {
  useFile,
  selectionFromLines,
  type FileSelection,
  type SelectedLineRange,
} from "@/context/file";
import { useLanguage } from "@/context/language";
import { useLayout } from "@/context/layout";
import { useLocal } from "@/context/local";
import { usePermission } from "@/context/permission";
import { usePrompt } from "@/context/prompt";
import { useSDK } from "@/context/sdk";
import { useSync } from "@/context/sync";
import { DialogSelectFile } from "@/components/dialog-select-file";
import { DialogSelectModel } from "@/components/dialog-select-model";
import { DialogSelectMcp } from "@/components/dialog-select-mcp";
import { DialogFork } from "@/components/dialog-fork";
import { DialogSessionTimeline } from "@/components/dialog-session-timeline";
import { showToast } from "@/ui/components/toast";
import { findLast } from "@/util/array";
import { extractPromptFromParts } from "@/utils/prompt";
import { UserMessage } from "@opencode-ai/sdk/v2";
import { canAddSelectionContext } from "@/pages/session/session-command-helpers";

export type SessionCommandContext = {
  navigateMessageByOffset: (offset: number) => void;
  setActiveMessage: (message: UserMessage | undefined) => void;
  focusInput: () => void;
};

const withCategory = (category: string) => {
  return (option: Omit<CommandOption, "category">): CommandOption => ({
    ...option,
    category,
  });
};

export const useSessionCommands = (actions: SessionCommandContext) => {
  const command = useCommand();
  const dialog = useDialog();
  const file = useFile();
  const language = useLanguage();
  const local = useLocal();
  const permission = usePermission();
  const prompt = usePrompt();
  const sdk = useSDK();
  const sync = useSync();
  const layout = useLayout();
  const params = useParams();
  const navigate = useNavigate();

  const sessionKey = createMemo(
    () => `${params.dir}${params.id ? "/" + params.id : ""}`,
  );
  const tabs = createMemo(() => layout.tabs(sessionKey));
  const view = createMemo(() => layout.view(sessionKey));
  const info = createMemo(() =>
    params.id ? sync.session.get(params.id) : undefined,
  );

  const idle = { type: "idle" as const };
  const status = createMemo(
    () => sync.data.session_status[params.id ?? ""] ?? idle,
  );
  const messages = createMemo(() =>
    params.id ? (sync.data.message[params.id] ?? []) : [],
  );
  const userMessages = createMemo(
    () => messages().filter((m) => m.role === "user") as UserMessage[],
  );
  const visibleUserMessages = createMemo(() => {
    const revert = info()?.revert?.messageID;
    if (!revert) return userMessages();
    return userMessages().filter((m) => m.id < revert);
  });

  const refreshReviewDiffs = async (sessionID: string) => {
    const directory = sdk.directory;
    sync.set(
      produce((draft) => {
        delete draft.session_diff[sessionID];
        delete draft.project_diff[directory];
      }),
    );
    await Promise.allSettled([
      sync.session.diff(sessionID),
      sync.projectDiff.diff(),
    ]);
  };

  const revertToMessage = async (message: UserMessage) => {
    const sessionID = params.id;
    if (!sessionID) return;
    if (status()?.type !== "idle") {
      await sdk.client.session.abort({ sessionID }).catch(() => { });
    }
    await sdk.client.session.revert({ sessionID, messageID: message.id });
    const parts = sync.data.part[message.id];
    if (parts) {
      const restored = extractPromptFromParts(parts, {
        directory: sdk.directory,
      });
      prompt.set(restored);
    }
    await refreshReviewDiffs(sessionID);
    const priorMessage = findLast(userMessages(), (x) => x.id < message.id);
    setActiveMessage(priorMessage);
  };

  const redoToMessage = async (message: UserMessage | undefined) => {
    const sessionID = params.id;
    if (!sessionID) return;
    const revertMessageID = info()?.revert?.messageID;
    if (!revertMessageID) return;
    if (!message) {
      await sdk.client.session.unrevert({ sessionID });
      prompt.reset();
      await refreshReviewDiffs(sessionID);
      const lastMsg = findLast(
        userMessages(),
        (x) => x.id >= revertMessageID,
      );
      setActiveMessage(lastMsg);
      return;
    }
    await sdk.client.session.revert({
      sessionID,
      messageID: message.id,
    });
    await refreshReviewDiffs(sessionID);
    const priorMsg = findLast(userMessages(), (x) => x.id < message.id);
    setActiveMessage(priorMsg);
  };

  const jumpToMessage = async (message: UserMessage | undefined) => {
    const revertMessageID = info()?.revert?.messageID;
    if (!message) {
      await redoToMessage(undefined);
      return;
    }
    if (!revertMessageID || message.id < revertMessageID) {
      await revertToMessage(message);
      return;
    }
    await redoToMessage(message);
  };

  const selectionPreview = (path: string, selection: FileSelection) => {
    const content = file.get(path)?.content?.content;
    if (!content) return undefined;
    const start = Math.max(1, Math.min(selection.startLine, selection.endLine));
    const end = Math.max(selection.startLine, selection.endLine);
    const lines = content.split("\n").slice(start - 1, end);
    if (lines.length === 0) return undefined;
    return lines.slice(0, 2).join("\n");
  };

  const addSelectionToContext = (path: string, selection: FileSelection) => {
    const preview = selectionPreview(path, selection);
    prompt.context.add({ type: "file", path, selection, preview });
  };

  const navigateMessageByOffset = actions.navigateMessageByOffset;
  const setActiveMessage = actions.setActiveMessage;
  const focusInput = actions.focusInput;

  const sessionCommand = withCategory(language.t("command.category.session"));
  const fileCommand = withCategory(language.t("command.category.file"));
  const contextCommand = withCategory(language.t("command.category.context"));
  const viewCommand = withCategory(language.t("command.category.view"));
  const modelCommand = withCategory(language.t("command.category.model"));
  const mcpCommand = withCategory(language.t("command.category.mcp"));
  const agentCommand = withCategory(language.t("command.category.agent"));
  const permissionsCommand = withCategory(
    language.t("command.category.permissions"),
  );

  const sessionCommands = createMemo(() => [
    sessionCommand({
      id: "session.new",
      title: language.t("command.session.new"),
      keybind: "mod+shift+s",
      slash: "new",
      onSelect: () => navigate(`/${params.dir}`),
    }),
  ]);

  const fileCommands = createMemo(() => [
    fileCommand({
      id: "file.open",
      title: language.t("command.file.open"),
      description: language.t("palette.search.placeholder"),
      keybind: "mod+p",
      slash: "open",
      onSelect: () => dialog.show(() => <DialogSelectFile />),
    }),
    fileCommand({
      id: "tab.close",
      title: language.t("command.tab.close"),
      keybind: "mod+w",
      disabled: !tabs().active(),
      onSelect: () => {
        const active = tabs().active();
        if (!active) return;
        tabs().close(active);
      },
    }),
  ]);

  const contextCommands = createMemo(() => [
    contextCommand({
      id: "context.addSelection",
      title: language.t("command.context.addSelection"),
      description: language.t("command.context.addSelection.description"),
      keybind: "mod+shift+l",
      disabled: !canAddSelectionContext({
        active: tabs().active(),
        pathFromTab: file.pathFromTab,
        selectedLines: file.selectedLines,
      }),
      onSelect: () => {
        const active = tabs().active();
        if (!active) return;
        const path = file.pathFromTab(active);
        if (!path) return;

        const range = file.selectedLines(path) as
          | SelectedLineRange
          | null
          | undefined;
        if (!range) {
          showToast({
            title: language.t("toast.context.noLineSelection.title"),
            description: language.t(
              "toast.context.noLineSelection.description",
            ),
          });
          return;
        }

        addSelectionToContext(path, selectionFromLines(range));
      },
    }),
  ]);

  const viewCommands = createMemo(() => [
    viewCommand({
      id: "review.toggle",
      title: language.t("command.review.toggle"),
      keybind: "mod+shift+r",
      onSelect: () => view().ikanbanPanel.toggle(),
    }),
    viewCommand({
      id: "input.focus",
      title: language.t("command.input.focus"),
      keybind: "ctrl+i",
      onSelect: () => focusInput(),
    }),
  ]);

  const messageCommands = createMemo(() => [
    sessionCommand({
      id: "message.previous",
      title: language.t("command.message.previous"),
      description: language.t("command.message.previous.description"),
      keybind: "mod+arrowup",
      disabled: !params.id,
      onSelect: () => navigateMessageByOffset(-1),
    }),
    sessionCommand({
      id: "message.next",
      title: language.t("command.message.next"),
      description: language.t("command.message.next.description"),
      keybind: "mod+arrowdown",
      disabled: !params.id,
      onSelect: () => navigateMessageByOffset(1),
    }),
  ]);

  const agentCommands = createMemo(() => [
    modelCommand({
      id: "model.choose",
      title: language.t("command.model.choose"),
      description: language.t("command.model.choose.description"),
      keybind: "mod+m",
      slash: "model",
      onSelect: () => dialog.show(() => <DialogSelectModel />),
    }),
    mcpCommand({
      id: "mcp.toggle",
      title: language.t("command.mcp.toggle"),
      description: language.t("command.mcp.toggle.description"),
      keybind: "mod+;",
      slash: "mcp",
      onSelect: () => dialog.show(() => <DialogSelectMcp />),
    }),
    agentCommand({
      id: "agent.cycle",
      title: language.t("command.agent.cycle"),
      description: language.t("command.agent.cycle.description"),
      keybind: "mod+.",
      slash: "agent",
      onSelect: () => local.agent.move(1),
    }),
    agentCommand({
      id: "agent.cycle.reverse",
      title: language.t("command.agent.cycle.reverse"),
      description: language.t("command.agent.cycle.reverse.description"),
      keybind: "shift+mod+.",
      onSelect: () => local.agent.move(-1),
    }),
    modelCommand({
      id: "model.variant.cycle",
      title: language.t("command.model.variant.cycle"),
      description: language.t("command.model.variant.cycle.description"),
      keybind: "shift+mod+d",
      onSelect: () => {
        local.model.variant.cycle();
      },
    }),
  ]);

  const permissionCommands = createMemo(() => [
    permissionsCommand({
      id: "permissions.autoaccept",
      title:
        params.id && permission.isAutoAccepting(params.id, sdk.directory)
          ? language.t("command.permissions.autoaccept.disable")
          : language.t("command.permissions.autoaccept.enable"),
      keybind: "mod+shift+a",
      disabled: !params.id || !permission.permissionsEnabled(),
      onSelect: () => {
        const sessionID = params.id;
        if (!sessionID) return;
        permission.toggleAutoAccept(sessionID, sdk.directory);
        showToast({
          title: permission.isAutoAccepting(sessionID, sdk.directory)
            ? language.t("toast.permissions.autoaccept.on.title")
            : language.t("toast.permissions.autoaccept.off.title"),
          description: permission.isAutoAccepting(sessionID, sdk.directory)
            ? language.t("toast.permissions.autoaccept.on.description")
            : language.t("toast.permissions.autoaccept.off.description"),
        });
      },
    }),
  ]);

  const sessionActionCommands = createMemo(() => [
    sessionCommand({
      id: "session.undo",
      title: language.t("command.session.undo"),
      description: language.t("command.session.undo.description"),
      slash: "undo",
      disabled: !params.id || visibleUserMessages().length === 0,
      onSelect: async () => {
        const revert = info()?.revert?.messageID;
        const message = findLast(
          userMessages(),
          (x) => !revert || x.id < revert,
        );
        if (!message) return;
        await revertToMessage(message);
      },
    }),
    sessionCommand({
      id: "session.timeline",
      title: language.t("command.session.timeline"),
      description: language.t("command.session.timeline.description"),
      slash: "timeline",
      disabled: !params.id || userMessages().length === 0,
      onSelect: () =>
        dialog.show(() => (
          <DialogSessionTimeline
            onSelect={(message) => {
              dialog.close();
              void jumpToMessage(message);
            }}
          />
        )),
    }),
    sessionCommand({
      id: "session.redo",
      title: language.t("command.session.redo"),
      description: language.t("command.session.redo.description"),
      slash: "redo",
      disabled: !params.id || !info()?.revert?.messageID,
      onSelect: async () => {
        const revertMessageID = info()?.revert?.messageID;
        if (!revertMessageID) return;
        const nextMessage = userMessages().find((x) => x.id > revertMessageID);
        await redoToMessage(nextMessage);
      },
    }),
    sessionCommand({
      id: "session.compact",
      title: language.t("command.session.compact"),
      description: language.t("command.session.compact.description"),
      slash: "compact",
      disabled: !params.id || visibleUserMessages().length === 0,
      onSelect: async () => {
        const sessionID = params.id;
        if (!sessionID) return;
        const model = local.model.current();
        if (!model) {
          showToast({
            title: language.t("toast.model.none.title"),
            description: language.t("toast.model.none.description"),
          });
          return;
        }
        await sdk.client.session.summarize({
          sessionID,
          modelID: model.id,
          providerID: model.provider.id,
        });
      },
    }),
    sessionCommand({
      id: "session.fork",
      title: language.t("command.session.fork"),
      description: language.t("command.session.fork.description"),
      slash: "fork",
      disabled: !params.id || visibleUserMessages().length === 0,
      onSelect: () => dialog.show(() => <DialogFork />),
    }),
  ]);

  command.register("session", () =>
    [
      sessionCommands(),
      fileCommands(),
      contextCommands(),
      viewCommands(),
      messageCommands(),
      agentCommands(),
      permissionCommands(),
      sessionActionCommands(),
    ].flatMap((x) => x),
  );
};
