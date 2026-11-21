// Server gate for player and scouting-note ids. Other files import these
// functions. This file does not read the service-role key and does not
// create tables. Row-level security remains the database backstop.
// See docs/security/idor-defense-notes.md.

import { getCurrentStaff } from './get-current-staff'

export type ResourceKind = 'player' | 'scouting_note'

/** UUID shape only. Quotes, spaces, and SQL text never match. */
const SAFE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertSafeIdentifier(rawId: unknown): string {
  if (typeof rawId !== 'string') {
    throw new Error('Identifier must be text')
  }
  const id = rawId.trim()
  if (!SAFE_UUID.test(id)) {
    throw new Error('Identifier is not a safe id')
  }
  return id
}

/**
 * Role names copied from docs/security/role-access-matrix.md and
 * docs/access/access-matrix-v2.md. A role missing from this map cannot read
 * either kind of record. There is no per-team scope here: both matrices
 * treat players, games, and scouting data as team-wide for every signed-in
 * staff role in this single-team app, so there is no team id to narrow by.
 */
const MAY_READ: Record<string, readonly ResourceKind[]> = {
  coaching: ['player'],
  scouting: ['player', 'scouting_note'],
  medical: ['player'],
  assistant_scout: ['player', 'scouting_note'],
  video_analyst: ['player', 'scouting_note'],
}

/**
 * Pure decision: does this role may read this kind of record? `role` is
 * `null` when the caller has no known role (see authorizeResource below) —
 * that always denies, matching "no role means no access"
 * (docs/security/rls-policy-spec.md).
 */
export function decideResourceAccess(role: string | null, kind: ResourceKind): 'allow' | 'deny' {
  if (!role) return 'deny'
  const allowed = MAY_READ[role] ?? []
  return allowed.includes(kind) ? 'allow' : 'deny'
}

/**
 * Verifies the id is safe, the caller is signed in, and the caller's role
 * may read this kind of record, in that order. A denied read and a missing
 * read both throw this same error so the caller cannot tell them apart.
 *
 * Today this always denies: docs/security/role-access-matrix.md open
 * question 1 (how a signed-in person's role is recorded) is still open, and
 * getCurrentStaff (src/server/get-current-staff.ts) does not return a role
 * yet, on purpose, until that question is answered. When a real role source
 * lands, pass its value into decideResourceAccess in place of `null` below;
 * decideResourceAccess itself is already correct against both matrices.
 */
export async function authorizeResource(input: { kind: ResourceKind; id: string }): Promise<{
  staffId: string
  resourceId: string
}> {
  const resourceId = assertSafeIdentifier(input.id)

  const staff = await getCurrentStaff()
  if (!staff?.id) {
    throw new Error('Sign-in required')
  }

  const role: string | null = null
  const decision = decideResourceAccess(role, input.kind)
  if (decision !== 'allow') {
    // Same outcome the caller should use when the row is simply missing.
    throw new Error('Record not found')
  }

  return { staffId: staff.id, resourceId }
}
