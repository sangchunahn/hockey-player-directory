// Server-only Supabase client.
//
// ⚠️ DO NOT IMPORT THIS FROM ROUTES OR COMPONENTS. ⚠️
//
// This module reads SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level
// Security entirely — it is a master key to the database. Whatever a route file
// imports, Vite bundles and ships to the browser.
//
// Note that a TanStack Start route `loader` runs on the server for first paint
// AND in the browser on client-side navigation, so "it's only in a loader" is
// not a safe place for this. Import it only from server functions and other
// `*.server.ts` modules.
//
// The `.server.ts` suffix is the signal to the next teammate (and to reviewers)
// that this file is on the server side of the boundary described in
// `docs/client-vs-server-inventory.md`.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { serverEnv } from '#app/config/env'

/**
 * Cached client. `createClient` opens no connection on its own — it builds a
 * configured HTTP caller — so one instance is safe to reuse across requests,
 * and reusing it avoids rebuilding the client on every server-function call.
 *
 * Safe to cache specifically *because* this client carries no per-user session:
 * it always acts as the service role. A client that held a logged-in user's
 * session must never be shared this way (relevant when Auth lands in Sprint 4).
 */
let cachedClient: SupabaseClient | null = null

/**
 * Returns the Supabase client authenticated with the service role key.
 *
 * Call only from server functions or other server-only modules.
 *
 * Throws — loudly and by name — if `SUPABASE_URL` or
 * `SUPABASE_SERVICE_ROLE_KEY` is missing, or if this somehow runs in a browser.
 * Both checks live in `serverEnv` (see `app/config/env.ts`), so a missing value
 * surfaces here as a named setup error rather than as a confusing Supabase auth
 * failure later. There is deliberately no fallback and no empty-string default:
 * a broken client should fail at construction, not at query time.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (cachedClient) return cachedClient

  // Reading these getters is what enforces the boundary. `serverEnv` refuses to
  // run in a browser and refuses to return an empty value.
  const url = serverEnv.SUPABASE_URL
  const serviceRoleKey = serverEnv.SUPABASE_SERVICE_ROLE_KEY

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      // All three are browser-session behaviors with no meaning on a server,
      // and leaving them on would have this client try to persist or refresh a
      // session that does not exist.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return cachedClient
}
