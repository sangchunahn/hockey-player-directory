// Shared rules for the `playerId` path param, so the route module, the players
// index links, and any future loaders all agree on one definition.
//
// Sprint 1 validation rule (see docs/params-design-notes.md): a player id is a
// non-empty string after trimming. Stricter formats (jersey numbers, roster
// UUIDs) can tighten this later without touching the route or the links.

export type PlayerIdParam = string

/**
 * Normalise a raw path-param value into a valid player id, or `null` if it
 * cannot be one. Never returns an empty string.
 */
export function parsePlayerIdParam(value: unknown): PlayerIdParam | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Build the canonical detail URL for a player id (URL-encoded). */
export function playerDetailPath(playerId: string): string {
  return `/players/${encodeURIComponent(playerId.trim())}`
}
