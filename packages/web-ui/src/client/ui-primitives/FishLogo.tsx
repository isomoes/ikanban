import type { IconProps } from './icons/props.ts'

/** Render the compact iKanban board mark. */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
    >
      <rect width="512" height="512" rx="112" fill="#131010" />
      <rect x="96" y="120" width="88" height="112" rx="16" fill="#fff" />
      <rect x="96" y="248" width="88" height="144" rx="16" fill="#5A5858" />
      <rect x="212" y="120" width="88" height="176" rx="16" fill="#5A5858" />
      <rect x="212" y="312" width="88" height="80" rx="16" fill="#fff" />
      <rect x="328" y="120" width="88" height="80" rx="16" fill="#fff" />
      <rect x="328" y="216" width="88" height="112" rx="16" fill="#5A5858" />
      <rect x="328" y="344" width="88" height="48" rx="16" fill="#fff" />
    </svg>
  )
}
