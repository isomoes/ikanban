/** Return the short label shown beside the product headline. */
export function buildBadge(version: string, development: boolean): string {
  return development ? 'dev' : `v${version}`
}

/** Distinguish development browser windows from release builds. */
export function productTitle(title: string, development: boolean): string {
  return development ? `${title} dev` : title
}
