/**
 * Timeline command plugin, node half. The behavior is browser-owned; this
 * entry exports pure option derivation for focused tests.
 */
export { restartTimelineChoice, timelineChoices, timelineLabel } from './timeline.ts'
export type { TimelineChoice, TimelineRestartServices, TimelineSnapshot } from './timeline.ts'

/** Host plugin body — no host-side behavior beyond existing Session APIs. */
export function apply(ctx: unknown): void { void ctx }
