// getCurrentStaff: the first server entry behind requireSession
// (auth-session plan, "Server functions that must call require-session").
//
// Takes NO input. Who is asking comes only from the verified session cookie,
// never from a userId or email the browser sends. Signed out means a 401 error,
// never empty "fake staff" data that looks like success.
//
// Returns only safe identity fields (id, email, role): no access token, refresh
// token, or raw session. The role comes from public.current_staff_role() (added
// in supabase/migrations/20250321000000_hockey_staff_rls.sql), called through the
// per-request, session-bound client from requireSession — the public anon key
// plus this person's own cookies, never the service-role key. That function
// reads only the caller's own staff_profiles row (auth.uid()), which matches the
// role-access-matrix "staff_role_assignment: own row only" cell; it does not
// require role-access-matrix open question Q1 (how an admin ASSIGNS a role) to
// be answered, since this only READS whatever role, if any, is already assigned.
//
// If the RPC call errors — the migration not yet applied to this project, the
// function renamed, Auth briefly unreachable, anything — role is null. A null
// role must never be retried against the service-role key or treated as "allow
// everything"; decideResourceAccess (src/server/authorizeResource.ts) already
// denies on a null role, so an RPC failure here fails closed the same way a
// real "no role assigned" row would.

import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

import { requireSession, UnauthorizedError, type SessionUser } from '#/lib/auth/require-session'

export type CurrentStaff = SessionUser & { role: string | null }

export const getCurrentStaff = createServerFn({ method: 'GET' }).handler(async (): Promise<CurrentStaff> => {
  try {
    const { user, supabase } = await requireSession()

    // Not in the generated Database type yet (src/types/database.ts was last
    // regenerated before this RPC's migration; see docs/typegen-notes.md). Typed
    // narrowly here, on this one call, rather than widening the whole client.
    const rpc = supabase.rpc as unknown as (fn: 'current_staff_role') => Promise<{
      data: string | null
      error: { message: string } | null
    }>
    const { data: role, error } = await rpc('current_staff_role')

    // Fail closed: an RPC error is treated the same as "no role," never as
    // "try again with a more privileged key" and never as "allow."
    return { id: user.id, email: user.email, role: error ? null : role }
  } catch (error) {
    // Fail closed with a real HTTP status, so the caller sees 401/503, not 200.
    if (error instanceof UnauthorizedError) setResponseStatus(error.status)
    throw error
  }
})
