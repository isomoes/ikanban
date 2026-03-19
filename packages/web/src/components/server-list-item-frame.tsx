/** @jsxImportSource solid-js */
import { Show, type JSX } from "solid-js"

export function ServerListItemFrame(props: { row: JSX.Element; actions?: JSX.Element }) {
  return (
    <div data-slot="server-list-item-frame" class="flex min-w-0 w-full items-center gap-1">
      <div class="min-w-0 flex-1">{props.row}</div>
      <Show when={props.actions}>
        <div data-slot="server-list-item-actions" class="flex shrink-0 items-center justify-center pr-3">
          {props.actions}
        </div>
      </Show>
    </div>
  )
}
