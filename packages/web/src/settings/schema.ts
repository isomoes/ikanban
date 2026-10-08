import { Effect, Option, Schema, SchemaGetter } from "effect"
import { timelinePresets, type TimelineCategory } from "@ikanban/session-ui/timeline/detail"
import { Persistence } from "@/runtime/persistence/schema"

export type Settings = typeof settingsSchema.Type
export type WorkspaceDefaultDestination = Settings["workspaces"]["defaultDestination"]
export type WorkspaceLastUsed = Settings["workspaces"]["lastUsed"][string]
export type TerminalPlacement = Settings["general"]["terminalPlacement"]
export type FollowUpBehavior = Settings["general"]["followUpBehavior"]
export type TabLayout = Settings["appearance"]["tabLayout"]
export type NotificationSettings = Settings["notifications"]
export type SoundSettings = Settings["sounds"]

const placementSchema = Schema.Literals(["separate", "grouped", "hidden"])
const detailsSchema = Schema.Literals(["collapsed", "expanded"])
const activitySchema = Persistence.struct({ placement: placementSchema, details: detailsSchema })
const placementOnlySchema = Persistence.struct({ placement: placementSchema })

const generalSchema = Persistence.struct({
  autoSave: Schema.Boolean,
  showFileTree: Schema.Boolean,
  showNavigation: Schema.Boolean,
  showSearch: Schema.Boolean,
  showProjectIcon: Schema.Boolean,
  showTerminal: Schema.Boolean,
  timelineDetail: Persistence.struct({
    shell: activitySchema,
    edit: activitySchema,
    thinking: activitySchema,
    subagents: placementOnlySchema,
    notices: placementOnlySchema,
    tools: placementOnlySchema,
  }),
  showCustomAgents: Schema.Boolean,
  mobileTitlebarPosition: Schema.Literals(["top", "bottom"]),
  mobileDiffWrap: Schema.Boolean,
  terminalPlacement: Schema.Literals(["side", "bottom"]),
  followUpBehavior: Schema.Literals(["queue", "steer"]),
})

const appearanceSchema = Persistence.struct({
  fontSize: Schema.Number,
  mono: Schema.String,
  sans: Schema.String,
  terminal: Schema.String,
  tabLayout: Schema.Literals(["horizontal", "vertical"]),
  showProjectName: Schema.Boolean,
})

const permissionsSchema = Persistence.struct({
  autoApprove: Schema.Boolean,
})

const workspacesSchema = Persistence.struct({
  defaultDestination: Schema.Literals(["last-used", "local", "new"]),
  lastUsed: Persistence.record(
    Schema.Literals(["local", "workspace"]).pipe(Schema.catchDecoding(() => Effect.succeed(Option.none()))),
  ),
})

const notificationsSchema = Persistence.struct({
  agent: Schema.Boolean,
  permissions: Schema.Boolean,
  errors: Schema.Boolean,
})

const soundsSchema = Persistence.struct({
  agentEnabled: Schema.Boolean,
  agent: Schema.String,
  permissionsEnabled: Schema.Boolean,
  permissions: Schema.String,
  errorsEnabled: Schema.Boolean,
  errors: Schema.String,
})

export const settingsSchema = Persistence.struct({
  general: generalSchema,
  sessionSummary: Persistence.struct({ projectExpanded: Schema.Boolean, serverExpanded: Schema.Boolean }),
  appearance: appearanceSchema,
  keybinds: Persistence.record(Schema.String.pipe(Schema.catchDecoding(() => Effect.succeed(Option.none())))),
  permissions: permissionsSchema,
  workspaces: workspacesSchema,
  notifications: notificationsSchema,
  sounds: soundsSchema,
})

function storedTimelineCategory(category: TimelineCategory) {
  return Persistence.optional(
    Schema.Union([
      Schema.Struct({
        placement: Persistence.optional(placementSchema),
        details: Persistence.optional(detailsSchema),
      }),
      Schema.Literals(["expanded", "collapsed", "hidden", "visible"]),
    ]).pipe(
      Schema.decode({
        decode: SchemaGetter.transform((value) => {
          if (typeof value !== "string") return value
          return {
            placement:
              value === "hidden"
                ? "hidden"
                : category === "subagents"
                  ? "separate"
                  : category === "tools"
                    ? "grouped"
                    : value === "expanded"
                      ? "separate"
                      : value === "collapsed"
                        ? "grouped"
                        : undefined,
            details: value === "expanded" ? "expanded" : "collapsed",
          }
        }),
        encode: SchemaGetter.passthrough(),
      }),
    ),
  )
}

function legacyTimelineActivity(value: boolean | "hidden" | "compact" | "full" | null | undefined) {
  if (value === undefined || value === null) return
  const expanded = value === true || value === "full"
  return {
    placement: value === "hidden" ? "hidden" : expanded ? "separate" : "grouped",
    details: expanded ? "expanded" : "collapsed",
  } as const
}

export const settingsPersistence = Persistence.migrate(
  settingsSchema,
  Schema.Struct({
    general: Persistence.optional(
      Schema.Struct({
        // Keep invalid explicit values distinct from absent values so legacy preferences cannot replace them.
        timelineDetail: Schema.optional(
          Schema.NullOr(
            Schema.Struct({
              shell: storedTimelineCategory("shell"),
              edit: storedTimelineCategory("edit"),
              thinking: storedTimelineCategory("thinking"),
              subagents: storedTimelineCategory("subagents"),
              notices: storedTimelineCategory("notices"),
              tools: storedTimelineCategory("tools"),
            }),
          ),
        ).pipe(Schema.catchDecoding(() => Effect.succeed(Option.some(null)))),
        reasoningMode: Schema.optional(Schema.NullOr(Schema.Literals(["hidden", "compact", "full"]))).pipe(
          Schema.catchDecoding(() => Effect.succeed(Option.some(null))),
        ),
        showReasoningSummaries: Persistence.optional(Schema.Boolean),
        shellToolPartsExpanded: Persistence.optional(Schema.Boolean),
        editToolPartsExpanded: Persistence.optional(Schema.Boolean),
      }),
    ),
  }).pipe(
    Schema.decode({
      decode: SchemaGetter.transform((value) => {
        const general = value.general
        if (!general || general.timelineDetail !== undefined) return value
        return {
          ...value,
          general: {
            ...general,
            timelineDetail: {
              shell: legacyTimelineActivity(general.shellToolPartsExpanded),
              edit: legacyTimelineActivity(general.editToolPartsExpanded),
              thinking: legacyTimelineActivity(
                general.reasoningMode === undefined ? general.showReasoningSummaries : general.reasoningMode,
              ),
            },
          },
        }
      }),
      encode: SchemaGetter.transform((value) => value),
    }),
  ),
)

export const defaultSettings: Settings = {
  general: {
    autoSave: true,
    showFileTree: false,
    showNavigation: false,
    showSearch: false,
    showProjectIcon: false,
    showTerminal: false,
    timelineDetail: { ...timelinePresets[2].value },
    showCustomAgents: false,
    mobileTitlebarPosition: "top",
    mobileDiffWrap: true,
    terminalPlacement: "side",
    followUpBehavior: "steer",
  },
  sessionSummary: { projectExpanded: true, serverExpanded: true },
  appearance: { fontSize: 14, mono: "", sans: "", terminal: "", tabLayout: "horizontal", showProjectName: false },
  keybinds: {},
  permissions: { autoApprove: false },
  workspaces: { defaultDestination: "last-used", lastUsed: {} },
  notifications: { agent: true, permissions: true, errors: false },
  sounds: {
    agentEnabled: true,
    agent: "staplebops-01",
    permissionsEnabled: true,
    permissions: "staplebops-02",
    errorsEnabled: true,
    errors: "nope-03",
  },
}
