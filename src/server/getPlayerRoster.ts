// Thin server boundary for one player roster read.
// Front desk only: parse the id, decide read-vs-write, call the service,
// map the outcome. No Supabase client, no business rule. The CSRF/origin
// check (src/server/csrf.ts) is wired into the write branch below, guarded
// by callChangesData, and never runs on the read path — a missing or
// foreign-origin CSRF signal must never fail a read. See
// docs/architecture/layer-map.md.

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { checkCsrf } from './csrf'
import { getCurrentStaff } from './get-current-staff'
import { readPlayerRosterForStaff, type PlayerRosterView, type StaffActor } from '../services/playerRosterService'

export type PlayerRosterResponse = { ok: true; player: PlayerRosterView } | { ok: false; error: string }

const PLAYER_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/

// This boundary only reads. A write would set this to true and run the CSRF
// helper (src/server/csrf.ts) before calling the service. A missing or
// foreign-origin CSRF signal must never fail a read — that is a login or
// origin problem for a different kind of request, not this one.
const callChangesData = false as const

export function parsePlayerId(raw: unknown): { ok: true; playerId: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Player id is not valid.' }
  }
  const playerId = raw.trim()
  if (!PLAYER_ID_PATTERN.test(playerId)) {
    return { ok: false, error: 'Player id is not valid.' }
  }
  return { ok: true, playerId }
}

// The service/data-access import chain is only reached from inside this
// handler closure, never from a second plain exported function. That is
// what lets TanStack Start split it into a server-only chunk instead of
// bundling the Supabase client into the browser (see src/data/playerAccess.ts).
export const getPlayerRoster = createServerFn({ method: 'GET' })
  .validator((input: unknown) => input)
  .handler(async ({ data: rawPlayerId }): Promise<PlayerRosterResponse> => {
    const parsed = parsePlayerId(rawPlayerId)
    if (!parsed.ok) {
      return parsed
    }

    // callChangesData is always false in this file, so this branch never
    // runs today — but if a later edit ever flips it, the CSRF/origin check
    // (src/server/csrf.ts) must run here, before the service is called,
    // exactly like the write routes in src/routes/api/events.ts and
    // src/routes/api/evaluations.ts. It is called ONLY inside this branch:
    // the read path above never reaches this line, so a missing or
    // foreign-origin CSRF signal can never fail a read.
    if (callChangesData) {
      const csrf = checkCsrf(getRequest())
      if (!csrf.ok) {
        return { ok: false, error: 'Could not load this player.' }
      }
      // A real write boundary would call the service here, after the CSRF
      // check above passes. This file only reads, so there is nothing
      // further to call.
      return { ok: false, error: 'Could not load this player.' }
    }

    try {
      // The route resolves who is asking and hands it to the service as
      // ordinary data — the service itself never reads a session.
      const staff = await getCurrentStaff()
      const actor: StaffActor = { staffId: staff.id, role: staff.role }

      const result = await readPlayerRosterForStaff(actor, parsed.playerId)
      switch (result.outcome) {
        case 'missing_id':
          return { ok: false, error: 'Player id is not valid.' }
        case 'not_allowed':
        case 'not_found':
          // Same message either way: denied and missing must look alike
          // (docs/security/idor-defense-notes.md).
          return { ok: false, error: 'Player not found.' }
        case 'allowed':
          return { ok: true, player: result.view }
      }
    } catch {
      // The service's or data-access layer's real error never reaches the
      // browser: no table name, no stack trace.
      return { ok: false, error: 'Could not load this player.' }
    }
  })
