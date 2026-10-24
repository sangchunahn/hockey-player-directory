// Staff sign-out: auth-session plan session rule 6 ("Sign-out ends it everywhere").
//
// Browser helper. It uses the BROWSER Supabase client. auth.signOut() revokes the
// session with Supabase Auth and clears the session cookies, so the next request
// to a protected server function fails its session check.
//
// Never throws to the UI. It always returns { ok, message }.

import { createSupabaseBrowserClient } from '#/lib/supabase/client'

export type SignOutResult = { ok: true } | { ok: false; message: string }

/** Signs the current staff member out and clears their session. */
export async function signOut(): Promise<SignOutResult> {
  try {
    const { error } = await createSupabaseBrowserClient().auth.signOut()
    if (error) return { ok: false, message: 'Sign-out failed. Please try again.' }
    return { ok: true }
  } catch {
    return { ok: false, message: 'Could not reach the sign-in service. Check your connection and try again.' }
  }
}
