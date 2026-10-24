// getCurrentStaff: the first server entry behind requireSession
// (auth-session plan, "Server functions that must call require-session").
//
// Takes NO input. Who is asking comes only from the verified session cookie,
// never from a userId or email the browser sends. Signed out means a 401 error,
// never empty "fake staff" data that looks like success.
//
// Returns only safe identity fields (id, email): no access token, refresh token,
// or raw session. The staff ROLE (coaching / scouting / medical) is not returned
// yet, because how roles are assigned is still role-access-matrix open question
// Q1. It is added here once that is decided, read from a server-side record and
// never from the client.

import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

import { requireSession, UnauthorizedError, type SessionUser } from '#/lib/auth/require-session'

export type CurrentStaff = SessionUser

export const getCurrentStaff = createServerFn({ method: 'GET' }).handler(async (): Promise<CurrentStaff> => {
  try {
    const { user } = await requireSession()
    return { id: user.id, email: user.email }
  } catch (error) {
    // Fail closed with a real HTTP status, so the caller sees 401/503, not 200.
    if (error instanceof UnauthorizedError) setResponseStatus(error.status)
    throw error
  }
})
