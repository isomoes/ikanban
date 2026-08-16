/**
 * Browser-owned /timeline command. A selection forks at the completed turn
 * immediately before that user prompt, restores the prompt as an editable
 * draft in the opened child, then cancels and archives the source.
 */
import type { ClientContext, SessionFace, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ClientSessionContext } from '@isomoes/dsh-ikanban/client/ui-input-trigger/client'
import type { CommandUiContract, SelectOption } from '@isomoes/dsh-ikanban/client/ui-commands/client'
import type { IConversation } from '@isomoes/dsh-ikanban/client/ui-conversation/client'
import type {} from '@isomoes/dsh-ikanban/client/locale/client'
import {
  restartTimelineChoice, timelineChoices, timelineLabel,
  type TimelineChoice, type TimelineSnapshot,
} from '../timeline.ts'
import { TimelineDraftLanding } from './DraftLanding.tsx'
import { en, zh, type TimelineKey } from './locales.ts'

export type { TimelineKey } from './locales.ts'

declare module '@isomoes/dsh-ikanban/client/ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy owned by the /timeline branch-and-restart command. */
    timeline: TimelineKey
  }
}

const NS = 'timeline'

export const inject = ['commandUi', 'sessions', 'workspaces', 'locale', 'conversation', 'slots']

function sessionFace(ctx: ClientContext, session: ClientSessionContext): SessionFace {
  const face = ctx.sessions.binding(session.sessionId)?.session
  if (face === undefined) throw new Error('timeline requires a materialized session')
  return face
}

async function completeHistory(face: SessionFace, signal: AbortSignal): Promise<void> {
  while (face.getSnapshot().hasMore) {
    signal.throwIfAborted()
    const before = face.getSnapshot().chat.order.length
    await face.loadOlder()
    signal.throwIfAborted()
    const after = face.getSnapshot()
    if (after.hasMore && after.chat.order.length <= before) {
      throw new Error(after.openError?.message ?? 'timeline could not load older messages')
    }
  }
}

function choicesOf(face: SessionFace): TimelineChoice[] {
  return timelineChoices(face.getSnapshot() as unknown as TimelineSnapshot)
}

function selectedChoice(face: SessionFace, option: SelectOption): TimelineChoice {
  const choice = choicesOf(face).find(candidate => candidate.id === option.id)
  if (choice === undefined) throw new Error('the selected timeline message is no longer available')
  return choice
}

/** Wait until cancellation is reflected by the live session snapshot. */
async function waitForQuiescence(face: SessionFace): Promise<void> {
  if (!face.getSnapshot().running) return
  await new Promise<void>((resolve, reject) => {
    let settled = false
    let timer: number | undefined
    let unsubscribe = (): void => {}
    const finish = (error?: Error): void => {
      if (settled) return
      settled = true
      if (timer !== undefined) window.clearTimeout(timer)
      unsubscribe()
      if (error === undefined) resolve()
      else reject(error)
    }
    unsubscribe = face.subscribe(() => {
      if (!face.getSnapshot().running) finish()
    })
    timer = window.setTimeout(() => {
      finish(new Error('timeline timed out waiting for the original session to stop'))
    }, 15_000)
    if (!face.getSnapshot().running) finish()
  })
}

/** Register the local /timeline popup command. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-timeline: dictionaries')
  const t = ctx.locale.bind(NS)
  const command = ctx.get('commandUi') as CommandUiContract

  type PendingDraft = {
    readonly text: string
    readonly sourceId: SessionId
    readonly resolve: () => void
    readonly reject: (error: Error) => void
    readonly timer: number
  }
  const pendingDrafts = new Map<SessionId, PendingDraft>()
  const landDraft = (childId: SessionId): void => {
    const pending = pendingDrafts.get(childId)
    if (pending === undefined) return
    try {
      const binding = ctx.sessions.binding(childId)
      const conversation = binding?.ctx.get('conversation') as IConversation | undefined
      if (binding === undefined || conversation === undefined) {
        throw new Error('timeline branch was created but its composer is unavailable')
      }
      const input = conversation.input.for(binding.ctx)
      input.setDraft(pending.text)
      if (input.state.getSnapshot().draft !== pending.text) {
        throw new Error('timeline could not restore the selected message')
      }
      window.clearTimeout(pending.timer)
      pendingDrafts.delete(childId)
      pending.resolve()
    } catch (error) {
      window.clearTimeout(pending.timer)
      pendingDrafts.delete(childId)
      ctx.sessions.open(pending.sourceId)
      pending.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }
  const activateChild = (childId: SessionId, sourceId: SessionId, text: string): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        const pending = pendingDrafts.get(childId)
        if (pending === undefined) return
        pendingDrafts.delete(childId)
        ctx.sessions.open(sourceId)
        reject(new Error('timeline timed out waiting for the child composer'))
      }, 15_000)
      pendingDrafts.set(childId, { text, sourceId, resolve, reject, timer })
      ctx.sessions.open(childId)
    })

  ctx.effect(() => {
    return () => {
      for (const pending of pendingDrafts.values()) {
        window.clearTimeout(pending.timer)
        ctx.sessions.open(pending.sourceId)
        pending.reject(new Error('timeline plugin was disposed before draft restoration'))
      }
      pendingDrafts.clear()
    }
  }, 'ui-timeline: pending draft transfers')

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'timeline-draft-landing',
    order: -1000,
    inject: (sessionId: SessionId) => ({ land: () => { landDraft(sessionId) } }),
  }, TimelineDraftLanding))

  ctx.effect(() => command.register({
    name: 'timeline',
    description: t('command.description'),
    available: session => {
      const summary = ctx.sessions.list.getSnapshot().byId[session.sessionId]
      return summary !== undefined && !summary.blank && summary.origin !== 'subagent'
    },
    ui: {
      kind: 'popupSelect',
      options: async (session, signal) => {
        const face = sessionFace(ctx, session)
        await completeHistory(face, signal)
        return choicesOf(face).map(choice => ({
          id: choice.id,
          label: timelineLabel(choice.text),
          detail: t('option.turn', { turn: choice.turn }),
        }))
      },
      onSelect: async (option, session) => {
        const source = sessionFace(ctx, session)
        if (source.getSnapshot().queue.some(item => item.placement !== 'context')) {
          throw new Error('timeline requires the pending message queue to be empty')
        }
        const choice = selectedChoice(source, option)
        await restartTimelineChoice(session.sessionId, choice, {
          fork: async (sourceId, atSeq) => await ctx.sessions.fork({
            sessionId: sourceId as typeof session.sessionId,
            atSeq,
            increaseTitle: true,
          }),
          activateChild: async (childId, text) => {
            await activateChild(childId as SessionId, session.sessionId, text)
          },
          quiesceSource: async () => {
            if (source.getSnapshot().queue.some(item => item.placement !== 'context')) {
              throw new Error('timeline stopped because pending input arrived on the original session')
            }
            if (!source.getSnapshot().running) return
            const stopped = await source.cancel()
            if (!stopped.ok) {
              throw new Error(`timeline could not stop the original session: ${stopped.error.message}`)
            }
            await waitForQuiescence(source)
          },
          archiveSource: async (sourceId) => {
            await ctx.workspaces.archiveSession(sourceId as SessionId)
          },
          recoverSource: () => { ctx.sessions.open(session.sessionId) },
        })
      },
    },
  }), 'ui-timeline: /timeline contribution')
}
