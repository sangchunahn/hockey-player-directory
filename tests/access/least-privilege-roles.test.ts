// Break-tests for the least-privilege staff roles.
//
// Case list (the thinking):   docs/access/adversarial-test-cases.md
// Expected results come from: docs/access/access-matrix-v2.md
// Change under test:          supabase/migrations/20260418120000_least_privilege_new_staff_roles.sql
//
// Every database attempt runs AS A TEST ACCOUNT: the public anon key plus that
// account's own sign-in, so row-level security sees the real role. This file never
// uses the service-role key, not even for setup; it refuses to run if handed one.
// It never turns row-level security off, adds grants, or edits the migration.
//
// Secrets come only from environment variables (names listed in the case list).
// If any is missing, the database cases are SKIPPED with the missing names in the
// reason. They are never silently passed.
//
// How allow/deny is judged (see the case list):
//   allow read    -> at least 1 row
//   deny read     -> 0 rows, or a permission error (RLS usually returns an empty list)
//   deny change   -> a permission error, or 0 rows changed (.select() returns the changed rows)
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

import { getPlayerById, listPlayers } from '#/server/directoryLoader'

const ENV_NAMES = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'TEST_ASSISTANT_SCOUT_EMAIL',
  'TEST_ASSISTANT_SCOUT_PASSWORD',
  'TEST_VIDEO_ANALYST_EMAIL',
  'TEST_VIDEO_ANALYST_PASSWORD',
  'TEST_MEDICAL_EMAIL',
  'TEST_MEDICAL_PASSWORD',
] as const

const missingEnv = ENV_NAMES.filter((name) => !process.env[name]?.trim())
const dbReady = missingEnv.length === 0
const skipReason = dbReady ? '' : ` [skipped: missing env ${missingEnv.join(', ')}]`

/** Words that would mark a medical or injury flag on a shared row. */
const FLAG_FIELDS = ['status', 'injury', 'injured', 'medical', 'medical_flag', 'health', 'ir', 'cleared']

/** Marker rows the medical account creates for the control and deny cases. */
const MED_METRIC = 'break_test_injury_status' // medical data
const SS_METRIC = 'break_test_training_load' // sports-science data

function env(name: (typeof ENV_NAMES)[number]): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

/** Refuses to run with anything that looks like the service-role (master) key. */
function assertNotServiceRoleKey(key: string): void {
  if (key.startsWith('sb_secret_')) throw new Error('Refusing to run: VITE_SUPABASE_ANON_KEY is a secret key.')
  if (key.startsWith('eyJ')) {
    const payload: unknown = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString('utf8'))
    if (typeof payload === 'object' && payload !== null && 'role' in payload && payload.role === 'service_role') {
      throw new Error('Refusing to run: VITE_SUPABASE_ANON_KEY is the service-role key.')
    }
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && key === process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Refusing to run: the anon key equals the service-role key.')
  }
}

function anonClient(): SupabaseClient {
  const key = env('VITE_SUPABASE_ANON_KEY')
  assertNotServiceRoleKey(key)
  return createClient(env('VITE_SUPABASE_URL'), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** A client signed in as one test account (its own session, its own role). */
async function signedInAs(emailVar: (typeof ENV_NAMES)[number], passwordVar: (typeof ENV_NAMES)[number]) {
  const client = anonClient()
  const { data, error } = await client.auth.signInWithPassword({ email: env(emailVar), password: env(passwordVar) })
  if (error || !data.user) throw new Error(`Sign-in failed for ${emailVar}: ${error?.message ?? 'no user'}`)
  return { client, userId: data.user.id }
}

/** Deny read: no rows, or a permission error. */
function expectNoRows(result: { data: unknown[] | null; error: { code?: string } | null }) {
  if (result.error) {
    expect(['42501', 'PGRST301']).toContain(result.error.code)
    return
  }
  expect(result.data ?? []).toHaveLength(0)
}

/** Deny change: a permission error, or zero rows changed. */
function expectNotChanged(result: { data: unknown[] | null; error: { code?: string } | null }) {
  if (result.error) {
    expect(result.error.code).toBe('42501')
    return
  }
  expect(result.data ?? []).toHaveLength(0)
}

describe.skipIf(!dbReady)(`least-privilege staff roles (database)${skipReason}`, () => {
  let scout: SupabaseClient
  let scoutId: string
  let analyst: SupabaseClient
  let medic: SupabaseClient
  let medRowId: string
  let ssRowId: string
  let playerId: string
  let gameId: string
  let scoutNoteId: string

  beforeAll(async () => {
    ;({ client: scout, userId: scoutId } = await signedInAs('TEST_ASSISTANT_SCOUT_EMAIL', 'TEST_ASSISTANT_SCOUT_PASSWORD'))
    ;({ client: analyst } = await signedInAs('TEST_VIDEO_ANALYST_EMAIL', 'TEST_VIDEO_ANALYST_PASSWORD'))
    ;({ client: medic } = await signedInAs('TEST_MEDICAL_EMAIL', 'TEST_MEDICAL_PASSWORD'))

    // Medical (allowed) makes sure one medical row and one sports-science row exist.
    const players = await medic.from('players').select('id').limit(1)
    expect(players.error).toBeNull()
    playerId = (players.data?.[0] as { id: string } | undefined)?.id ?? ''
    expect(playerId, 'need at least one player in the database').not.toBe('')

    for (const [metric, value] of [
      [MED_METRIC, 1],
      [SS_METRIC, 400],
    ] as const) {
      const existing = await medic.from('sports_science_records').select('id').eq('metric', metric).limit(1)
      expect(existing.error).toBeNull()
      let id = (existing.data?.[0] as { id: string } | undefined)?.id
      if (!id) {
        const inserted = await medic
          .from('sports_science_records')
          .insert({ player_id: playerId, measured_on: '2026-04-18', metric, value })
          .select('id')
          .single()
        expect(inserted.error).toBeNull()
        id = (inserted.data as { id: string }).id
      }
      if (metric === MED_METRIC) medRowId = id
      else ssRowId = id
    }

    const games = await scout.from('games').select('id').limit(1)
    gameId = (games.data?.[0] as { id: string } | undefined)?.id ?? ''
  })

  // ---- Allowed reads: the jobs still work ----

  it('AS-CHANGE-OWN-SCOUT: assistant scout can add and correct their own note', async () => {
    expect(gameId, 'need at least one game').not.toBe('')
    const added = await scout
      .from('scouting_events')
      .insert({ player_id: playerId, game_id: gameId, event_type: 'note', note: 'Break-test observation' })
      .select('id, recorded_by')
      .single()
    expect(added.error).toBeNull()
    expect((added.data as { recorded_by: string }).recorded_by).toBe(scoutId)
    scoutNoteId = (added.data as { id: string }).id

    const corrected = await scout.from('scouting_events').update({ period: 1 }).eq('id', scoutNoteId).select('id')
    expect(corrected.error).toBeNull()
    expect(corrected.data).toHaveLength(1)
  })

  it('AS-READ-SCOUT: assistant scout can read scouting notes', async () => {
    const res = await scout.from('scouting_events').select('id, event_type, note').limit(5)
    expect(res.error).toBeNull()
    expect((res.data ?? []).length).toBeGreaterThan(0)
  })

  it('AS-READ-GAME: assistant scout can read game data', async () => {
    const games = await scout.from('games').select('id, played_on').limit(5)
    const players = await scout.from('players').select('id, display_name').limit(5)
    expect(games.error).toBeNull()
    expect(players.error).toBeNull()
    expect((games.data ?? []).length).toBeGreaterThan(0)
    expect((players.data ?? []).length).toBeGreaterThan(0)
  })

  it('VA-READ-SCOUT: video analyst can read scouting notes', async () => {
    const res = await analyst.from('scouting_events').select('id, event_type, note').limit(5)
    expect(res.error).toBeNull()
    expect((res.data ?? []).length).toBeGreaterThan(0)
  })

  it('VA-READ-GAME: video analyst can read game data', async () => {
    const games = await analyst.from('games').select('id, played_on').limit(5)
    const players = await analyst.from('players').select('id, display_name').limit(5)
    expect(games.error).toBeNull()
    expect(players.error).toBeNull()
    expect((games.data ?? []).length).toBeGreaterThan(0)
    expect((players.data ?? []).length).toBeGreaterThan(0)
  })

  // ---- Control: medical can see medical, so the denies below are a real seal ----

  it('MED-READ-MED (control): medical can read medical data', async () => {
    const res = await medic.from('sports_science_records').select('id, metric').in('id', [medRowId, ssRowId])
    expect(res.error).toBeNull()
    expect(res.data).toHaveLength(2)
  })

  // ---- Sealed: medical data ----

  it('AS-READ-MED: assistant scout cannot read medical data', async () => {
    expectNoRows(await scout.from('sports_science_records').select('id, metric, value').eq('id', medRowId))
    expectNoRows(await scout.from('sports_science_records').select('id').limit(50))
  })

  it('AS-CHANGE-MED: assistant scout cannot change medical data', async () => {
    expectNotChanged(await scout.from('sports_science_records').update({ value: 0 }).eq('id', medRowId).select('id'))
    const insert = await scout
      .from('sports_science_records')
      .insert({ player_id: playerId, measured_on: '2026-04-18', metric: 'injury_note', value: 1 })
      .select('id')
    expect(insert.error?.code).toBe('42501')
  })

  it('VA-READ-MED: video analyst cannot read medical data', async () => {
    expectNoRows(await analyst.from('sports_science_records').select('id, metric, value').eq('id', medRowId))
    expectNoRows(await analyst.from('sports_science_records').select('id').limit(50))
  })

  it('VA-CHANGE-MED: video analyst cannot change medical data', async () => {
    expectNotChanged(await analyst.from('sports_science_records').update({ value: 0 }).eq('id', medRowId).select('id'))
    const insert = await analyst
      .from('sports_science_records')
      .insert({ player_id: playerId, measured_on: '2026-04-18', metric: 'injury_note', value: 1 })
      .select('id')
    expect(insert.error?.code).toBe('42501')
  })

  // ---- Sealed: sports-science data ----

  it('AS-READ-SS: assistant scout cannot read sports-science data', async () => {
    expectNoRows(await scout.from('sports_science_records').select('id, metric, value').eq('id', ssRowId))
  })

  it('AS-CHANGE-SS: assistant scout cannot change sports-science data', async () => {
    expectNotChanged(await scout.from('sports_science_records').update({ value: 9999 }).eq('id', ssRowId).select('id'))
    expectNotChanged(await scout.from('sports_science_records').delete().eq('id', ssRowId).select('id'))
  })

  it('VA-READ-SS: video analyst cannot read sports-science data', async () => {
    expectNoRows(await analyst.from('sports_science_records').select('id, metric, value').eq('id', ssRowId))
  })

  it('VA-CHANGE-SS: video analyst cannot change sports-science data', async () => {
    expectNotChanged(await analyst.from('sports_science_records').update({ value: 9999 }).eq('id', ssRowId).select('id'))
    expectNotChanged(await analyst.from('sports_science_records').delete().eq('id', ssRowId).select('id'))
  })

  // ---- Medical flags on the shared player list (database side) ----

  it('AS-FLAG-SHARED: assistant scout gets no medical flag on the shared player list (players table)', async () => {
    const res = await scout.from('players').select('*').limit(20)
    expect(res.error).toBeNull()
    for (const row of res.data ?? []) {
      for (const field of FLAG_FIELDS) expect(row).not.toHaveProperty(field)
    }
  })

  it('VA-FLAG-SHARED: video analyst gets no medical flag on the shared player list (players table)', async () => {
    const res = await analyst.from('players').select('*').limit(20)
    expect(res.error).toBeNull()
    for (const row of res.data ?? []) {
      for (const field of FLAG_FIELDS) expect(row).not.toHaveProperty(field)
    }
  })

  // ---- Extra cases ----

  it('VA-CHANGE-SCOUT: video analyst cannot add a scouting note', async () => {
    const insert = await analyst
      .from('scouting_events')
      .insert({ player_id: playerId, game_id: gameId, event_type: 'note', note: 'should be refused' })
      .select('id')
    expect(insert.error?.code).toBe('42501')
    expectNotChanged(await analyst.from('scouting_events').update({ period: 2 }).eq('id', scoutNoteId).select('id'))
  })

  it('ANON-READ-SCOUT: signed-out visitor gets no scouting or medical rows', async () => {
    const visitor = anonClient()
    expectNoRows(await visitor.from('scouting_events').select('id').limit(5))
    expectNoRows(await visitor.from('sports_science_records').select('id').limit(5))
  })
})

// ---- Medical flags on the shared screens (app side) ----
// /players and /players/$playerId are served by listPlayers / getPlayerById for
// every visitor alike (they don't look at who is signed in), so what they return
// is exactly what the assistant scout and the video analyst would see. These run
// without the database.
describe('medical flags on the shared player screens (app loader)', () => {
  /** Every player record the shared screens receive that still carries a flag-like field or an 'ir' value. */
  const injuryShown = () =>
    [...listPlayers(), ...listPlayers().map((p) => getPlayerById(p.id))].filter(
      (p): p is NonNullable<typeof p> =>
        p !== null &&
        (FLAG_FIELDS.some((field) => field in p) || Object.values(p).some((value) => value === 'ir')),
    )

  it('AS-FLAG-SHARED: assistant scout gets no medical flag on the shared player list (/players, /players/$playerId)', () => {
    expect(injuryShown(), 'players exposed with an injured-reserve flag').toHaveLength(0)
  })

  it('VA-FLAG-SHARED: video analyst gets no medical flag on the shared player list (/players, /players/$playerId)', () => {
    expect(injuryShown(), 'players exposed with an injured-reserve flag').toHaveLength(0)
  })
})
