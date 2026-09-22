export function KanbanMark(props: { class?: string }) {
  return (
    <svg
      class={props.class}
      viewBox="64 88 384 336"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="96" y="120" width="88" height="112" rx="16" />
      <rect x="96" y="248" width="88" height="144" rx="16" opacity="0.45" />
      <rect x="212" y="120" width="88" height="176" rx="16" opacity="0.45" />
      <rect x="212" y="312" width="88" height="80" rx="16" />
      <rect x="328" y="120" width="88" height="80" rx="16" />
      <rect x="328" y="216" width="88" height="112" rx="16" opacity="0.45" />
      <rect x="328" y="344" width="88" height="48" rx="16" />
    </svg>
  )
}
