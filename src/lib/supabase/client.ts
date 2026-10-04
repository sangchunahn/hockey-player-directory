// Typed Supabase client for scouting reads — the ONLY client src/lib/scouting/
// uses.
//
// Typed with the generated `Database` (src/types/database.ts), so every
// `.from()` table name, `.select()` column, and `.eq()` filter is checked by
// `tsc`. Rename a column, regenerate types, and the broken query fails the
// typecheck instead of failing a scout at runtime.
//
// Uses the PUBLIC anon key only (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY,
// read through publicEnv in app/config/env.ts). It is safe on both the server
// and in the browser because it carries no secret: Row Level Security decides
// what the anon key may read. The service-role client stays in
// app/lib/supabase.server.ts and must never be imported here.
//
// Created LAZILY, like publicEnv: importing this module never throws, so the
// app still boots before .env.local is filled in. The first query fails with a
// message that names the missing variable.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { publicEnv } from '#app/config/env'
import type { Database } from '#/types/database'

export type TypedSupabaseClient = SupabaseClient<Database>

let cachedClient: TypedSupabaseClient | null = null

/**
 * Returns the shared anon-key client, typed with `Database`.
 *
 * Throws "Missing required public env var VITE_SUPABASE_URL" (or
 * VITE_SUPABASE_ANON_KEY) with setup instructions if either is unset.
 */
export function getSupabase(): TypedSupabaseClient {
  if (cachedClient) return cachedClient

  cachedClient = createClient<Database>(
    publicEnv.SUPABASE_URL,
    publicEnv.SUPABASE_ANON_KEY,
    // No login exists yet (out of scope until Sprint 4), so there is no
    // session to persist or refresh.
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  return cachedClient
}
