// MouseEvent.button uses 1 for the middle/wheel button.
export const MIDDLE_MOUSE_BUTTON = 1

import type { Ref } from "solid-js"

export function isTabCloseTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('[data-slot="tab-close"]')
}

export function forwardTabRef(ref: Ref<HTMLDivElement> | undefined, element: HTMLDivElement) {
  if (typeof ref === "function") ref(element)
}

export function canOpenTabRename(dragging: boolean | undefined, editing: boolean, pending: boolean) {
  return !dragging && !editing && !pending
}
