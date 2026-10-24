// BROWSER Supabase client: public settings only.
// (Server functions use ./server.ts instead. See docs/security/auth-session-plan.md.)
//
// Used for (auth-session plan, "Browser vs server Supabase client"):
//   - starting sign-in and sign-out on the page (next step);
//   - keeping the session cookies fresh in the browser;
//   - the Sprint 3 scouting hooks, until they move behind server functions.
// Never used for deciding what someone may see: the browser is controlled by
// its user, so server functions re-check the session with ./server.ts and RLS
// filters rows in Postgres.
//
// Reads ONLY the two public, VITE_-prefixed values (via publicEnv in
// app/config/env.ts): VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. The anon key
// is public by design. It must never read SUPABASE_SERVICE_ROLE_KEY or any other
// secret; that key bypasses RLS and lives only in app/lib/supabase.server.ts.
//
// `createBrowserClient` (@supabase/ssr) stores the session in cookies, not
// localStorage. That way the browser sends the session to the server on every
// request, which the server client reads to verify who is asking.
//
// Typed with the generated `Database`, so table, column and filter names are
// checked by `tsc`.

import { createBrowserClient } from '@supabase/ssr'

import { publicEnv } from '#app/config/env'
import type { Database } from '#/types/database'

/** Creates the browser Supabase client. Throws a setup message if either public env var is missing. */
export function createSupabaseBrowserClient() {
  // publicEnv throws "Missing required public env var VITE_SUPABASE_…" with
  // setup steps, so a missing value is caught here instead of three layers down.
  return createBrowserClient<Database>(publicEnv.SUPABASE_URL, publicEnv.SUPABASE_ANON_KEY)
}

export type TypedSupabaseClient = ReturnType<typeof createSupabaseBrowserClient>

let cachedClient: TypedSupabaseClient | null = null

/**
 * The shared browser client, created on first use. Importing this module never
 * throws, so the app still boots before .env.local is filled in.
 *
 * Kept for the Sprint 3 modules in src/lib/scouting/, which call it from the
 * browser.
 */
export function getSupabase(): TypedSupabaseClient {
  cachedClient ??= createSupabaseBrowserClient()
  return cachedClient
}
