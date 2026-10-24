// Staff sign-in: auth-session plan step 1 ("Login").
//
// Browser helper. It uses the BROWSER Supabase client (src/lib/supabase/client.ts),
// because sign-in starts on the page. On success, Supabase Auth creates a session
// and the browser client stores it in cookies. Later requests carry those cookies
// to the server, where server functions re-check them (require-session, a later
// step). Signing in only proves who you are; what you may see is decided on the
// server and by RLS (docs/security/role-access-matrix.md).
//
// Never throws to the UI. It always returns { ok, message } so the login form
// can show a readable error.

import { createSupabaseBrowserClient } from '#/lib/supabase/client'

export type SignInResult = { ok: true } | { ok: false; message: string }

const UNREACHABLE = 'Could not reach the sign-in service. Check your connection and try again.'

/** Turns a Supabase Auth error into a sentence a staff member can act on. */
function toSignInMessage(code: string | undefined, status: number | undefined): string {
  // supabase-js reports a network failure as an error with status 0 (not a throw).
  if (status === 0) return UNREACHABLE
  if (code === 'invalid_credentials') return 'Wrong email or password.'
  if (code === 'email_not_confirmed') return 'This account has not been confirmed yet. Ask an admin to confirm it.'
  if (status === 429) return 'Too many sign-in attempts. Wait a minute and try again.'
  return 'Sign-in failed. Please try again.'
}

/** Signs a staff member in with email and password. */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const trimmedEmail = email.trim()
  if (!trimmedEmail || !password) {
    return { ok: false, message: 'Email and password are required.' }
  }

  try {
    const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })
    if (error) return { ok: false, message: toSignInMessage(error.code, error.status) }
    return { ok: true }
  } catch {
    // Missing env vars, or the request failed before Supabase answered.
    return { ok: false, message: UNREACHABLE }
  }
}
