import type { IconProps } from './icons/props.ts'

/** Display options for the iKanban wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading iKanban mark; defaults to true. */
  includeMark?: boolean | undefined
}

/** Render the iKanban mark and product name as a single wordmark. */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const width = includeMark ? 116 : 84
  return (
    <svg
      width={(size * width) / 24}
      height={size}
      className={className}
      viewBox={includeMark ? '0 0 116 24' : '32 0 84 24'}
      fill="none"
      aria-hidden="true"
    >
      <g transform="scale(0.046875)">
        <rect width="512" height="512" rx="112" fill="#131010" />
        <rect x="96" y="120" width="88" height="112" rx="16" fill="#fff" />
        <rect x="96" y="248" width="88" height="144" rx="16" fill="#5A5858" />
        <rect x="212" y="120" width="88" height="176" rx="16" fill="#5A5858" />
        <rect x="212" y="312" width="88" height="80" rx="16" fill="#fff" />
        <rect x="328" y="120" width="88" height="80" rx="16" fill="#fff" />
        <rect x="328" y="216" width="88" height="112" rx="16" fill="#5A5858" />
        <rect x="328" y="344" width="88" height="48" rx="16" fill="#fff" />
      </g>
      <text
        x="32"
        y="17.5"
        fill="currentColor"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="17"
        fontWeight="650"
        letterSpacing="-0.4"
      >
        iKanban
      </text>
    </svg>
  )
}
