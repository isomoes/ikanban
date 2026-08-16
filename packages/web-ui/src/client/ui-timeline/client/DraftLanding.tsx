import { useEffect } from 'react'

/** Invisible child-composer mount sentinel used to land a pending timeline draft. */
export function TimelineDraftLanding({ land }: { readonly land: () => void }) {
  useEffect(() => {
    // Run after every passive effect from this commit has installed, including
    // ConversationSession's durable draft mirror.
    queueMicrotask(land)
  }, [land])
  return null
}
