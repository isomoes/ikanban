import { createSignal } from "solid-js"
import { createResizeObserver } from "@solid-primitives/resize-observer"
import { Tooltip } from "@ikanban/ui/tooltip"
import { getFilename } from "@opencode/util/path"

export function WorkspacePath(props: { directory: string }) {
  const [truncated, setTruncated] = createSignal(false)
  const name = () => getFilename(props.directory)

  return (
    <Tooltip
      value={props.directory}
      placement="top-start"
      disabled={!truncated()}
      contentClass="max-w-[calc(100vw-32px)] break-all"
    >
      <span
        ref={(element) => createResizeObserver(element, () => setTruncated(element.scrollWidth > element.clientWidth))}
        tabIndex={truncated() ? 0 : undefined}
        dir="ltr"
        aria-label={props.directory}
        class="settings-workspaces-path"
      >
        <span>{props.directory.slice(0, -name().length)}</span>
        <span class="settings-workspaces-path-name">{name()}</span>
      </span>
    </Tooltip>
  )
}
