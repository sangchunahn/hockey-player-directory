// Unit tests for the server-side session gate (src/lib/auth/require-session.ts).
//
// The server Supabase client is MOCKED, so these run with no network, no
// database and no secrets. What is under test is the real requireSession():
// success returns only safe identity fields; every failure FAILS CLOSED
// (throws UnauthorizedError), so a protected server function such as
// listScoutingNotes never reaches its query.
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requireSession, UnauthorizedError } from './require-session'

// Fake auth.getUser(): the verify-with-Supabase-Auth call requireSession makes.
const getUser = vi.fn()
const createSupabaseServerClient = vi.fn(() => ({ auth: { getUser } }))

vi.mock('#/lib/supabase/server', () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
}))

/** Runs requireSession and returns what it threw (or fails the test if it didn't). */
async function rejection(): Promise<unknown> {
  try {
    await requireSession()
  } catch (error) {
    return error
  }
  throw new Error('requireSession resolved, but it should have failed closed')
}

describe('requireSession', () => {
  beforeEach(() => {
    getUser.mockReset()
    createSupabaseServerClient.mockClear()
  })

  it('returns the verified staff identity when Supabase Auth confirms the session', async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: 'staff-user-uuid-1',
          email: 'scout@example.test',
          app_metadata: { provider: 'email' },
          aud: 'authenticated',
        },
      },
      error: null,
    })

    const session = await requireSession()

    expect(session.user).toEqual({ id: 'staff-user-uuid-1', email: 'scout@example.test' })
    // The user-bound server client is handed back so the caller's query runs as this user (RLS).
    expect(session.supabase).toBe(createSupabaseServerClient.mock.results[0]?.value)
    // Verified against Supabase Auth, not just read from the cookie.
    expect(getUser).toHaveBeenCalledTimes(1)
  })

  it('returns only safe fields: no tokens, metadata, or raw session', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'u1', email: null, app_metadata: { role: 'medical' }, user_metadata: { role: 'scouting' } } },
      error: null,
    })

    const { user } = await requireSession()

    expect(Object.keys(user).sort()).toEqual(['email', 'id'])
    expect(user.email).toBeNull()
  })

  it('fails closed with 401 when there is no session cookie', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 },
    })

    const error = await rejection()

    expect(error).toBeInstanceOf(UnauthorizedError)
    expect(error).toMatchObject({ status: 401, message: 'Unauthorized: sign in required.' })
  })

  it('fails closed with 401 when Supabase Auth rejects a forged, expired, or signed-out token', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthApiError', message: 'invalid JWT', status: 403 },
    })

    expect(await rejection()).toMatchObject({ status: 401 })
  })

  it('fails closed with 401 when Auth returns no user and no error', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    expect(await rejection()).toMatchObject({ status: 401 })
  })

  it('fails closed with 503 when Supabase Auth cannot be reached', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthRetryableFetchError', message: 'fetch failed', status: 0 },
    })

    expect(await rejection()).toMatchObject({ status: 503 })
  })

  it('fails closed with 503 when the verify call itself throws', async () => {
    getUser.mockRejectedValue(new Error('network down'))

    expect(await rejection()).toMatchObject({ status: 503 })
  })

  it('fails closed with 503 when the server client cannot be created (missing Supabase env vars)', async () => {
    createSupabaseServerClient.mockImplementationOnce(() => {
      throw new Error('Missing required public env var VITE_SUPABASE_URL.')
    })

    expect(await rejection()).toMatchObject({ status: 503 })
    expect(getUser).not.toHaveBeenCalled()
  })

  it('takes no caller input, so a browser-supplied user id or role cannot vouch for anyone', () => {
    expect(requireSession.length).toBe(0)
  })
})
