import type { HeroBrandMarkOwnerProps } from '@isomoes/dsh-web-ui/client/ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@isomoes/dsh-web-ui/client/ui-sidebar/client'

type IKanbanBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/** Render the compact iKanban board mark. */
export function IKanbanBrandMark({ size = 24, className }: IKanbanBrandMarkProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 512 512" fill="none" aria-hidden="true">
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

/** Render the iKanban name artwork without its independently slotted mark. */
export function IKanbanBrandName() {
  return (
    <svg width="84" height="24" viewBox="0 0 84 24" fill="none" aria-label="iKanban">
      <text x="0" y="17.5" fill="currentColor" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif" fontSize="17" fontWeight="650" letterSpacing="-0.4">iKanban</text>
    </svg>
  )
}
