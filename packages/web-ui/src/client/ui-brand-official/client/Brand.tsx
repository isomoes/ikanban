import { BrandWordmark, FishLogo } from '@isomoes/dsh-ikanban/client/ui-primitives'
import type { HeroBrandMarkOwnerProps } from '@isomoes/dsh-ikanban/client/ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@isomoes/dsh-ikanban/client/ui-sidebar/client'

type OfficialBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the official whale mark.
 */
export function OfficialBrandMark({ size, className }: OfficialBrandMarkProps) {
  return <FishLogo size={size} className={className} />
}

/**
 * Render the official name artwork without its independently slotted mark.
 * @returns the official name wordmark.
 */
export function OfficialBrandName() {
  return <BrandWordmark includeMark={false} />
}
