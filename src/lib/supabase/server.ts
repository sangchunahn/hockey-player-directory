// SERVER Supabase client: session-aware, for TanStack Start server functions only.
//
// ⚠️ DO NOT IMPORT FROM REACT COMPONENTS, ROUTE COMPONENTS, OR ANY BROWSER CODE. ⚠️
// The `server-only` import below makes the build fail if a browser module
// imports this file. Browser code uses ./client.ts.
//
// Role in docs/security/auth-session-plan.md, step 3 ("Server verify"):
//   1. A server function calls createSupabaseServerClient().
//   2. The client reads the staff member's session from the REQUEST'S COOKIES,
//      the ones the browser client set at sign-in.
//   3. The require-session helper (a later step) asks Supabase Auth to verify
//      that session, then queries AS THAT USER, so Postgres RLS filters rows by
//      role. No session means the helper fails closed, with no query and no rows.
//
// Uses the PUBLIC anon key plus the user's session, never the service-role key.
// The service-role client (app/lib/supabase.server.ts) bypasses RLS, so it must
// never answer a staff member's request for scouting or medical data.
//
// Create a new client per request; never cache one across requests. Each client
// carries one person's session, and sharing it would mix staff members up.

import '@tanstack/react-start/server-only'

import { createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'

import { publicEnv } from '#app/config/env'
import type { Database } from '#/types/database'

/**
 * Creates a Supabase client bound to the current request's session cookies.
 * Call it inside a server function, once per request.
 *
 * Throws a setup message if VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.
 */
export function createSupabaseServerClient() {
  return createServerClient<Database>(publicEnv.SUPABASE_URL, publicEnv.SUPABASE_ANON_KEY, {
    cookies: {
      // Session in: every cookie on the incoming request (Supabase picks out its own).
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }))
      },
      // Session out: when Supabase refreshes an expired access token, it writes the
      // new session cookies onto the response so the browser keeps them.
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options)
        }
      },
    },
  })
}

export type ServerSupabaseClient = ReturnType<typeof createSupabaseServerClient>
