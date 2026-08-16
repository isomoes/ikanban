/** Pure timeline option derivation shared by the browser plugin and tests. */

/** Minimal content-block shape required by the timeline picker. */
export interface TimelineContentBlock {
  readonly type: string
  readonly text?: string
}

/** Minimal turn location shape published by the conversation runtime. */
export interface TimelineTurnLocation {
  readonly turn: number
  readonly end?: { readonly seq: number }
}

/** Minimal Chat node shape consumed by timeline derivation. */
export interface TimelineChatNode {
  readonly key: string
  readonly kind: string
  readonly anchorSeq: number
  readonly visibility: 'visible' | 'hidden'
  readonly location:
    | { readonly kind: 'turn'; readonly turn: TimelineTurnLocation }
    | { readonly kind: 'step'; readonly turn: TimelineTurnLocation }
    | { readonly kind: string }
  readonly data: unknown
}

/** Minimal conversation snapshot shape consumed by timeline derivation. */
export interface TimelineSnapshot {
  readonly chat: {
    readonly order: readonly string[]
    readonly nodes: { get(key: string): TimelineChatNode | undefined }
    readonly timeline: {
      readonly turnOrder: readonly number[]
      readonly turns: ReadonlyMap<number, TimelineTurnLocation>
    }
  }
}

/** One selectable user prompt and the completed boundary preceding its turn. */
export interface TimelineChoice {
  readonly id: string
  readonly turn: number
  readonly time: number
  readonly text: string
  readonly forkAtSeq: number
}

function textOf(data: unknown): { text: string; time: number } | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const { content, time } = data as { readonly content?: unknown; readonly time?: unknown }
  if (!Array.isArray(content) || typeof time !== 'number' || !Number.isFinite(time)) return undefined
  const blocks = content as readonly TimelineContentBlock[]
  if (blocks.length === 0 || blocks.some(block => block.type !== 'text' || typeof block.text !== 'string')) return undefined
  const text = blocks.map(block => block.text ?? '').join('')
  return text.trim() === '' ? undefined : { text, time }
}

function turnOf(node: TimelineChatNode): number | undefined {
  return 'turn' in node.location ? node.location.turn.turn : undefined
}

function previousCompletedBoundary(
  turn: number,
  order: readonly number[],
  turns: ReadonlyMap<number, TimelineTurnLocation>,
): number | undefined {
  const position = order.indexOf(turn)
  if (position <= 0) return undefined
  for (let index = position - 1; index >= 0; index--) {
    const candidate = turns.get(order[index]!)?.end?.seq
    if (candidate !== undefined) return candidate
  }
  return undefined
}

/**
 * Return newest-first text-only user prompts that can be restarted safely.
 * The first turn is intentionally absent: session.fork requires a completed
 * prefix, and an image-bearing prompt cannot be reconstructed as an editable
 * browser draft from durable attachment references.
 */
export function timelineChoices(snapshot: TimelineSnapshot): TimelineChoice[] {
  const { order, nodes, timeline } = snapshot.chat
  const choices: TimelineChoice[] = []
  for (const key of order) {
    const node = nodes.get(key)
    if (node === undefined || node.kind !== 'user' || node.visibility !== 'visible') continue
    const turn = turnOf(node)
    const message = textOf(node.data)
    if (turn === undefined || message === undefined) continue
    const forkAtSeq = previousCompletedBoundary(turn, timeline.turnOrder, timeline.turns)
    if (forkAtSeq === undefined) continue
    choices.push({
      id: `user:${String(node.anchorSeq)}`,
      turn,
      time: message.time,
      text: message.text,
      forkAtSeq,
    })
  }
  return choices.sort((left, right) => right.turn - left.turn || right.time - left.time)
}

/** Compact a multi-line prompt for one popup option label. */
export function timelineLabel(text: string, maximum = 80): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  return compact.length <= maximum ? compact : `${compact.slice(0, Math.max(0, maximum - 1)).trimEnd()}…`
}

/** Side-effect boundary used by the branch/archive transaction. */
export interface TimelineRestartServices {
  fork(sourceId: string, atSeq: number): Promise<string>
  /** Open the child and resolve only after its mounted composer persisted the draft. */
  activateChild(childId: string, text: string): Promise<void>
  /** Clear pending input, cancel an active turn, and resolve at quiescence. */
  quiesceSource(): Promise<void>
  archiveSource(sourceId: string): Promise<void>
  /** Restore source selection when a post-activation operation fails. */
  recoverSource(): void
}

/**
 * Execute the ordered timeline transaction. Source destruction starts only
 * after the child composer confirms the replacement draft, and archiving
 * starts only after the old agent reaches quiescence.
 */
export async function restartTimelineChoice(
  sourceId: string,
  choice: TimelineChoice,
  services: TimelineRestartServices,
): Promise<string> {
  const childId = await services.fork(sourceId, choice.forkAtSeq)
  await services.activateChild(childId, choice.text)
  try {
    await services.quiesceSource()
    await services.archiveSource(sourceId)
    return childId
  } catch (error) {
    services.recoverSource()
    throw error
  }
}
