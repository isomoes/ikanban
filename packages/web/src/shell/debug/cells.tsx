import { Tooltip } from "@ikanban/ui/tooltip"

export function Cell(props: {
  bad?: boolean
  dim?: boolean
  inline?: boolean
  label: string
  tip: string
  value: string
  span?: 2 | 3
}) {
  const content = () => (
    <div
      classList={{
        "flex min-w-0 items-center": true,
        "min-h-[20px] w-fit justify-start px-1.5 py-0.5 text-left": !!props.inline,
        "justify-center text-center": !props.inline,
        "min-h-[42px] w-full flex-col rounded-[8px] px-0.5 py-1": !props.inline,
        "col-span-2": props.span === 2 && !props.inline,
        "col-span-3": props.span === 3 && !props.inline,
      }}
    >
      <div
        classList={{
          "flex min-w-0": true,
          "-translate-y-px items-baseline gap-1.5": !!props.inline,
          "flex-col items-center": !props.inline,
        }}
      >
        <div
          dir="ltr"
          classList={{
            "text-[10px] leading-none font-black uppercase tracking-[0.04em] opacity-70": true,
          }}
        >
          {props.label}
        </div>
        <div
          dir="ltr"
          classList={{
            "uppercase font-bold tabular-nums": true,
            "text-[11px] leading-text-tight": !!props.inline,
            "text-[13px] leading-text-compact sm:text-[14px]": !props.inline,
            "text-text-on-critical-base": !!props.bad,
            "opacity-70": !!props.dim,
          }}
        >
          {props.value}
        </div>
      </div>
    </div>
  )

  return (
    <Tooltip appearance={props.inline ? "compact" : "standard"} value={props.tip} placement="top">
      {content()}
    </Tooltip>
  )
}

export function ToggleCell(props: {
  active: boolean
  inline?: boolean
  label: string
  onClick: () => void
  tip: string
  value: string
}) {
  const content = () => (
    <button
      type="button"
      aria-label={`${props.label}: ${props.value}`}
      aria-pressed={props.active}
      classList={{
        "flex min-w-0 items-center font-mono uppercase hover:bg-surface-raised-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-border-focus": true,
        "min-h-[20px] w-fit justify-start rounded px-1.5 py-0.5 text-left": !!props.inline,
        "min-h-[42px] w-full flex-col justify-center rounded-[8px] px-0.5 py-1 text-center": !props.inline,
        "bg-surface-raised-base text-text-strong": props.active,
      }}
      onClick={props.onClick}
    >
      <span
        classList={{
          flex: true,
          "-translate-y-px items-baseline gap-1.5": !!props.inline,
          "flex-col items-center": !props.inline,
        }}
      >
        <span dir="ltr" class="text-[10px] leading-none font-black tracking-[0.04em] opacity-70">
          {props.label}
        </span>
        <span dir="ltr" class="text-[11px] leading-none font-bold">
          {props.value}
        </span>
      </span>
    </button>
  )

  return (
    <Tooltip appearance={props.inline ? "compact" : "standard"} value={props.tip} placement="top">
      {content()}
    </Tooltip>
  )
}
