// Typed WRITE helpers for the scouting board — the one place screens create or
// change players and events. Reads stay in ./queries.ts.
//
// Maps to "Writes scouts and ops need" in docs/scouting-data-requirements.md:
//   Create an event (scout) ...... createScoutingEvent(input)
//   Update an event (scout) ...... updateScoutingEvent(eventId, patch)
//   Update a player (ops) ........ updatePlayer(playerId, patch)
//
// Player notes: the schema has no notes column on `players`. A scout's note
// about a player is a scouting event with event_type 'note' (the `note` column
// is required for that type), tied to the player and the game it was observed
// in. Log one with createScoutingEvent; correct it with updateScoutingEvent.
//
// Rules this module keeps:
//   - Payloads are the generated Insert / Update types from src/types/database.ts
//     (narrowed to the fields each write may touch). No `any`, no casts, no
//     @ts-ignore — a renamed column fails `tsc` here.
//   - Obvious mistakes are caught BEFORE Supabase is called, mirroring the
//     database's own check constraints, so a bad row is never sent.
//   - Every helper returns { data, error }. It never throws and never fails
//     silently; `error.message` is written for a scout, not a DBA.
//   - Updates are partial, target exactly one row with .eq('id', ...), and
//     return the saved row via .select().single().
//   - No TanStack Query hooks or RPC calls here; later steps wrap these helpers.

import type { PostgrestError } from '@supabase/supabase-js'

import { getSupabase } from '#/lib/supabase/client'
import { Constants, type Database } from '#/types/database'

import type { PlayerRow, ScoutingEventRow } from './queries'

// ---------------------------------------------------------------------------
// Payload types — derived from the generated Insert / Update shapes
// ---------------------------------------------------------------------------

type Tables = Database['public']['Tables']

/** Columns the database fills in itself; callers never send them. */
type ServerManaged = 'id' | 'created_at' | 'updated_at'

/** Log an event: player_id, game_id, event_type required; period, note optional. */
export type CreateScoutingEventInput = Omit<Tables['scouting_events']['Insert'], ServerManaged>

/** Correct an event: only type, period, or note may change (not who or which game). */
export type UpdateScoutingEventPatch = Pick<Tables['scouting_events']['Update'], 'event_type' | 'period' | 'note'>

/** Correct a player: name, position, team label, sweater number. Events link by id, so renames are safe. */
export type UpdatePlayerPatch = Pick<Tables['players']['Update'], 'display_name' | 'position' | 'team_label' | 'sweater_number'>

/** Every write returns exactly one of these. */
export type MutationResult<T> =
  | { data: T; error: null }
  | { data: null; error: MutationError }

export type MutationError = {
  /** Plain-language message, safe to show a scout. */
  message: string
  /** Postgres / PostgREST code when the database rejected the write (for logs). */
  code?: string
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EVENT_TYPES: readonly string[] = Constants.public.Enums.scouting_event_type
const POSITIONS: readonly string[] = Constants.public.Enums.player_position

function fail(message: string, code?: string): { data: null; error: MutationError } {
  return { data: null, error: code ? { message, code } : { message } }
}

const isBlank = (value: string) => value.trim() === ''

/** Pre-flight id check: missing and malformed ids never reach Supabase. */
function checkId(label: string, value: string | null | undefined): string | null {
  if (!value || isBlank(value)) return `${label} is required.`
  if (!UUID_PATTERN.test(value)) return `${label} is not a valid id.`
  return null
}

/** Mirrors scouting_events_period_check (1–5; 4–5 are overtime/shootout). */
function checkPeriod(period: number | null | undefined): string | null {
  if (period == null) return null
  return Number.isInteger(period) && period >= 1 && period <= 5 ? null : 'Period must be a whole number from 1 to 5.'
}

/**
 * Turns a database rejection into a sentence a scout can act on. Codes are the
 * ones this schema can actually raise; anything else gets a generic message
 * (the raw text stays out of the UI and is kept on `code` for logs).
 */
function toMutationError(action: string, error: PostgrestError): { data: null; error: MutationError } {
  switch (error.code) {
    case '23503': // foreign_key_violation
      return fail(`Could not ${action}: that player or game does not exist.`, error.code)
    case '23514': // check_violation
      return fail(`Could not ${action}: a value is out of range or required text is blank.`, error.code)
    case '22P02': // invalid_text_representation (bad uuid / enum)
      return fail(`Could not ${action}: one of the values is not in the expected format.`, error.code)
    case '42501': // insufficient_privilege (Row Level Security)
      return fail(`Could not ${action}: you do not have permission to save this yet.`, error.code)
    case 'PGRST116': // .single() matched zero rows (wrong id, or RLS hid it)
      return fail(`Could not ${action}: no matching record was found.`, error.code)
    default:
      return fail(`Could not ${action}. Please try again.`, error.code)
  }
}

/** Runs one write; maps Supabase errors and unexpected throws into a result. */
async function runWrite<T>(
  action: string,
  write: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<MutationResult<T>> {
  try {
    const { data, error } = await write()
    if (error) return toMutationError(action, error)
    if (data === null) return fail(`Could not ${action}: the database returned no row.`)
    return { data, error: null }
  } catch {
    // Missing env vars, network failure — never surface a stack trace to a scout.
    return fail(`Could not ${action}: the database could not be reached.`)
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Log a scouting event (goal, hit, a 'note' about the player, ...).
 * Returns the saved row, including its new id and timestamps.
 */
export async function createScoutingEvent(
  input: CreateScoutingEventInput,
): Promise<MutationResult<ScoutingEventRow>> {
  const problem =
    checkId('Player', input.player_id) ??
    checkId('Game', input.game_id) ??
    (EVENT_TYPES.includes(input.event_type) ? null : `Event type must be one of: ${EVENT_TYPES.join(', ')}.`) ??
    checkPeriod(input.period) ??
    (input.event_type === 'note' && (input.note == null || isBlank(input.note))
      ? 'A note event needs note text.'
      : null) ??
    (input.note != null && isBlank(input.note) ? 'Note cannot be blank — leave it out instead.' : null)
  if (problem) return fail(problem)

  const row: Tables['scouting_events']['Insert'] = {
    player_id: input.player_id,
    game_id: input.game_id,
    event_type: input.event_type,
    period: input.period ?? null,
    note: input.note?.trim() ?? null,
  }

  return runWrite('log the event', () => getSupabase().from('scouting_events').insert(row).select().single())
}

/**
 * Correct one event's type, period, or note. Only the fields present in
 * `patch` change; every other event is untouched (.eq on the primary key).
 */
export async function updateScoutingEvent(
  eventId: string,
  patch: UpdateScoutingEventPatch,
): Promise<MutationResult<ScoutingEventRow>> {
  const problem =
    checkId('Event', eventId) ??
    (Object.values(patch).every((v) => v === undefined) ? 'Nothing to update — change the type, period, or note.' : null) ??
    (patch.event_type !== undefined && !EVENT_TYPES.includes(patch.event_type)
      ? `Event type must be one of: ${EVENT_TYPES.join(', ')}.`
      : null) ??
    checkPeriod(patch.period) ??
    (patch.note != null && isBlank(patch.note) ? 'Note cannot be blank — clear it instead.' : null)
  // Switching to 'note' while removing the text is caught by the database
  // (scouting_events_note_required_check) and reported via toMutationError.
  if (problem) return fail(problem)

  const changes: Tables['scouting_events']['Update'] = {
    ...patch,
    ...(patch.note != null ? { note: patch.note.trim() } : {}),
  }

  return runWrite('update the event', () =>
    getSupabase().from('scouting_events').update(changes).eq('id', eventId).select().single(),
  )
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

/**
 * Correct one player's name, position, team label, or sweater number.
 * Events reference players by id, so renaming never breaks their links.
 */
export async function updatePlayer(
  playerId: string,
  patch: UpdatePlayerPatch,
): Promise<MutationResult<PlayerRow>> {
  const problem =
    checkId('Player', playerId) ??
    (Object.values(patch).every((v) => v === undefined)
      ? 'Nothing to update — change the name, position, team, or number.'
      : null) ??
    (patch.display_name !== undefined && isBlank(patch.display_name) ? 'Player name cannot be blank.' : null) ??
    (patch.team_label !== undefined && isBlank(patch.team_label) ? 'Team cannot be blank.' : null) ??
    (patch.position !== undefined && !POSITIONS.includes(patch.position)
      ? `Position must be one of: ${POSITIONS.join(', ')}.`
      : null) ??
    (patch.sweater_number != null &&
    !(Number.isInteger(patch.sweater_number) && patch.sweater_number >= 0 && patch.sweater_number <= 99)
      ? 'Sweater number must be a whole number from 0 to 99.'
      : null)
  if (problem) return fail(problem)

  const changes: Tables['players']['Update'] = {
    ...patch,
    ...(patch.display_name !== undefined ? { display_name: patch.display_name.trim() } : {}),
    ...(patch.team_label !== undefined ? { team_label: patch.team_label.trim() } : {}),
  }

  return runWrite('update the player', () =>
    getSupabase().from('players').update(changes).eq('id', playerId).select().single(),
  )
}
