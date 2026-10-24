// requireSession: the server-side session gate from docs/security/auth-session-plan.md
// (step 3 "Server verify", session rules 1–4). Every server function that touches
// staff data calls this FIRST, before any query.
//
// Server only. It uses the session-aware server client (src/lib/supabase/server.ts),
// which reads the staff member's session from the request's cookies. It never
// takes a user id, email, role, or "isLoggedIn" flag from the caller. Those come
// from the browser, and the browser can lie.
//
// VERIFY, DON'T JUST READ (plan rule 2): it calls auth.getUser(), which sends the
// session's access token to Supabase Auth and gets back the user only if the token
// is genuine, unexpired, and not signed out. The scaffold's getSession() would
// only decode the cookie without checking it, so a forged or revoked cookie could
// pass.
//
// FAIL CLOSED (plan rule 4): no session, a bad session, or Auth being unreachable
// all throw. The calling server function stops before its query, with no partial
// rows and no fallback key.
//
// Returns the verified user AND the per-request server client. Callers run their
// queries with that client, as this user, so RLS can filter rows by role (later step).

import '@tanstack/react-start/server-only'

import { createSupabaseServerClient, type ServerSupabaseClient } from '#/lib/supabase/server'

/** The verified identity. Only safe fields: no tokens, no raw session. */
export type SessionUser = {
  id: string
  email: string | null
}

export type VerifiedSession = {
  user: SessionUser
  /** Server client bound to this user's session. Query with it so RLS applies. */
  supabase: ServerSupabaseClient
}

/**
 * Thrown when the caller has no verified session (401) or Auth could not be
 * reached to verify it (503). The message is safe to show; it never says why a
 * specific token was rejected.
 */
export class UnauthorizedError extends Error {
  readonly status: 401 | 503

  constructor(status: 401 | 503) {
    super(status === 401 ? 'Unauthorized: sign in required.' : 'Could not verify your session. Try again.')
    this.name = 'UnauthorizedError'
    this.status = status
  }
}

/**
 * Verifies the request's Supabase session on the server.
 * Resolves with the verified user, or throws UnauthorizedError.
 */
export async function requireSession(): Promise<VerifiedSession> {
  const supabase = createSupabaseServerClient()

  let result: Awaited<ReturnType<typeof supabase.auth.getUser>>
  try {
    result = await supabase.auth.getUser()
  } catch {
    throw new UnauthorizedError(503)
  }

  const { data, error } = result
  if (error || !data.user) {
    // supabase-js reports a network failure as status 0; everything else (no
    // cookie, expired, revoked, forged) means "not signed in".
    throw new UnauthorizedError(error?.status === 0 ? 503 : 401)
  }

  return {
    user: { id: data.user.id, email: data.user.email ?? null },
    supabase,
  }
}
