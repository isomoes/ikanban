export function nextModelOption(keys: readonly string[], active: string | undefined, direction: 1 | -1) {
  if (keys.length === 0) return ""
  const index = active === undefined ? -1 : keys.indexOf(active)
  if (index === -1) return keys[0]
  return keys[(index + direction + keys.length) % keys.length]
}
