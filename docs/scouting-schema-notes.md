# Scouting schema notes

**Date:** 2026-10-03
**Sprint:** 3 — scouting data layer
**Migration:** `supabase/migrations/001_scouting_schema.sql` (written, **not applied yet** — the next step applies it and generates types)
**Requirements:** `docs/scouting-data-requirements.md` — view ids (V1–V4) and criterion numbers below refer to that file

---

## The model at a glance

```text
players  1 ──< scouting_events >── 1  games
```

Three tables, one per entity in the brief. `players` and `games` are parents;
every `scouting_events` row points at exactly one of each. Players and games are
connected **only** through events — there is no separate roster or lineup table.

Naming rules: plural `snake_case` table names, `snake_case` columns, foreign keys
named `<parent>_id`, constraints named `<table>_<what>`.

---

## Tables

### `players` — a skater or goalie Northline scouts (brief: Player)

| Column | Type | Null? | Why |
|--------|------|-------|-----|
| `id` | `uuid` | no (PK) | The only identifier. Never reused, never changes. |
| `display_name` | `text` | no | V1 sort key; must not be blank. **Not unique** — two players can share a name. |
| `position` | `player_position` enum (`F`, `D`, `G`) | no | V1 filter. The brief says a player record needs a position. |
| `team_label` | `text` | no | V1 filter. The brief says a player record needs a team/org label. |
| `sweater_number` | `smallint` | **yes** | Display only. The brief says it is not an identifier and it changes between teams. 0–99. |
| `created_at` / `updated_at` | `timestamptz` | no | `updated_at` is kept current by a trigger (players are updatable). |

### `games` — one contest on a date between two sides (brief: Game)

| Column | Type | Null? | Why |
|--------|------|-------|-----|
| `id` | `uuid` | no (PK) | Identifier. |
| `played_on` | `date` | no | V2 date-range filter and the newest-first sort. |
| `home_team` | `text` | no | One of the two sides; must not be blank. |
| `away_team` | `text` | no | The other side; must differ from `home_team`. |
| `created_at` | `timestamptz` | no | Audit. No `updated_at` — the brief has no "update a game" write. |

A unique index on (`played_on`, normalized `home_team`, normalized `away_team`)
prevents two rows for the same contest. Normalized means trimmed and lower-cased.

### `scouting_events` — one observation of one player in one game (brief: Event)

| Column | Type | Null? | Why |
|--------|------|-------|-----|
| `id` | `uuid` | no (PK) | Identifier. |
| `player_id` | `uuid` → `players.id` | no | The event's player. An event without a player is meaningless (criterion 1). |
| `game_id` | `uuid` → `games.id` | no | The event's game. Same reason. |
| `event_type` | `scouting_event_type` enum | no | V3 filter and V4 grouping. Fixed list: `goal`, `assist`, `shot`, `hit`, `penalty`, `note`. |
| `period` | `smallint` | **yes** | Optional per the brief. Range 1–5: 1–3 regulation, 4 overtime, 5 shootout. |
| `note` | `text` | **yes** | Optional scout text. If present, it must not be blank. It is **required** when `event_type = 'note'`. |
| `created_at` / `updated_at` | `timestamptz` | no | `updated_at` is set by a trigger. It lets criterion 5 (write isolation) be checked: only the edited row's timestamp moves. |

---

## Relationships

| From | To | On delete | Meaning |
|------|----|-----------|---------|
| `scouting_events.player_id` | `players.id` | `restrict` | You cannot delete a player who still has events |
| `scouting_events.game_id` | `games.id` | `restrict` | You cannot delete a game that still has events |

- **One player → many events. One game → many events.**
- Both foreign keys are `NOT NULL`, so an event can never exist half-linked.
- Every join and filter uses these ids, never `display_name` text. This follows the brief's rule that lists must not match on names.

---

## Filters supported

| Brief view | Columns used | Index |
|------------|--------------|-------|
| **V1** player list: position, team label; sorted by name | `players.position`, `players.team_label`, `players.display_name` | `players_team_label_name_idx (team_label, display_name)` |
| **V2** game list: date range; newest first | `games.played_on` | `games_played_on_idx (played_on desc)` |
| **V3** events by player | `scouting_events.player_id` | `scouting_events_player_game_idx` (leading column) |
| **V3** events by game | `scouting_events.game_id` | `scouting_events_game_idx` |
| **V3** events by player **and** game | both | `scouting_events_player_game_idx (player_id, game_id)` |
| **V3** by event type; sorted by game date then period | `event_type`, joined `games.played_on`, `period` | none on `event_type` (only 6 values, so an index would not narrow much) |
| **V4** per-player totals: counts by type + distinct games; optional date range / position | `player_id`, `event_type`, `game_id`, joined `games.played_on`, `players.position` | `scouting_events_player_game_idx` supports group-by-player. The aggregate itself is an RPC in a later step. |

`players.position` has no index of its own: there are only three values, and the
table is small.

---

## Success-criteria traceability

| Brief criterion | Supported by |
|-----------------|--------------|
| 1 Join integrity | `NOT NULL` foreign keys on `player_id` and `game_id`. The database itself rejects an event for an unknown player or game. |
| 2 Filter fidelity | Real typed columns for every V1–V3 filter (enum, date, uuid). Nothing is buried in a JSON blob. |
| 3 Schema-change safety | Plain, typed columns plus enums. The next step's type generation turns these into exact TypeScript types; the enums become union types, not `string`. |
| 4 Aggregate correctness | `event_type` enum + `player_id` + `game_id` + the composite index. They give the later RPC everything it needs to count by type and distinct games per player. |
| 5 Write isolation | Updates target a single row's `uuid` primary key. `updated_at` moves only on the edited row. |
| 6 Cache freshness | Not a schema concern. It belongs to the TanStack Query step. |
| 7 Safe errors | Bad values are stopped at the database by enums and checks. The app layer still validates first, so scouts get a friendly message. |
| 8 Boundary preserved | RLS is enabled with no policies, so the browser's anon key cannot read or write these tables through Supabase's API. See below. |

---

## Decisions

1. **Enums for `position` and `event_type`, not free text.** The brief calls both
   fixed lists. Enums make Postgres reject anything else, and type generation emits
   a union type, so a typo is caught at compile time. *Trade-off:* adding a value
   needs a migration (`alter type … add value`), and removing one is hard. A check
   constraint would be easier to change but generates as plain `string`. Type safety
   wins for this sprint.
2. **`F`/`D`/`G` codes for position.** These match `PlayerPosition` in
   `src/lib/searchSchemas.ts`, so the existing `/players` position filter maps onto
   real data without translation. This also resolves Sprint 2 open risk #6, where
   the free-text `directory_people.position` didn't match `F`/`D`/`G`.
3. **`home_team` + `away_team`, not `opponent` + `is_home`.** Scouts watch games
   Northline isn't playing in, so "opponent" has no meaning there. The brief describes
   a game as "between two sides."
4. **`ON DELETE RESTRICT` on both foreign keys.** The brief puts deletion out of scope.
   Restrict means even a stray `DELETE` can't silently erase a player's event history
   or change totals. `CASCADE` would do exactly that.
5. **Nullability follows the brief's "required" list.** `display_name`, `position`,
   `team_label`, `played_on`, both teams, `event_type`, and both foreign keys are
   required. `sweater_number`, `period`, and `note` are optional, except that a
   `note`-type event must carry note text.
6. **`uuid` primary keys** (`gen_random_uuid()`, built into Postgres 13+, so no
   extension is needed). Ids appear in URLs like `/players/<id>`. Random uuids don't
   reveal row counts or creation order the way sequential integers would.
7. **RLS enabled with zero policies.** The step says no RLS *policies* yet, and none
   are added. Enabling RLS alone is deny-by-default. Supabase exposes `public` tables
   through its auto-generated API, which the anon key can reach, and the anon key ships
   to the browser on purpose. Without RLS, anyone could read or write scouting data
   directly and bypass the server function's validation. The server-only service-role
   client bypasses RLS, so the Sprint 2 path keeps working.
8. **Plain `create`, not `create … if not exists`.** A migration runs exactly once. If
   a table with the same name already exists, failing loudly is better than silently
   keeping a table whose columns may not match this file.
9. **No seed data in the migration.** The schema and demo rows have different
   lifecycles. Seeding gets its own file in the next step, so it can be re-run without
   re-running DDL.
10. **No "who recorded this" column.** The brief defers it until auth exists. Adding it
    later is a nullable-column migration, which won't break existing rows.

---

## Verified before commit

Without touching Supabase, the migration was run against a throwaway in-memory
Postgres (PGlite, real Postgres compiled to WASM). It executed cleanly, and each of
these was confirmed:

- a valid player + game + event inserts
- an event with an unknown `player_id` or unknown `game_id` → rejected (FK)
- `event_type = 'fight'`, `position = 'C'` → rejected (enum)
- a `note` event with no text → rejected
- a blank player name → rejected
- a duplicate matchup on the same date (differing only in case or spaces) → rejected
- a team playing itself → rejected
- `period = 9` → rejected
- deleting a player or a game that still has events → rejected (restrict)
- `updated_at` advances on update
- RLS enabled on all three tables

---

## Open questions for the next step

1. **`players` vs `directory_people`.** The brief left this open. This migration keeps
   them **separate**: `directory_people` mixes players and staff, uses free-text
   positions, and per Sprint 2 open risk #1 hasn't been created or seeded yet. If they
   should link, a later migration can add a nullable
   `players.directory_person_id → directory_people.id` without touching events.
2. **Who creates games?** The brief's writes table covers players and events only.
   For now, games come from seed data or ops entering them by hand. Confirm with
   stakeholders before building a game form.
3. **Migration file naming.** The Supabase CLI convention is a timestamp prefix
   (`20261003…_scouting_schema.sql`). The tutorial specifies `001_…`, which the CLI
   also accepts as a version. Before `supabase db push`, check
   `supabase migration list` against the remote. `directory_people` was created in
   the dashboard, so the remote may have no migration history to conflict with, but
   confirm it.
4. **Period range.** 1–5 assumes 3 regulation periods, overtime, and a shootout.
   Confirm with scouts whether multiple overtimes (playoffs) need tracking.
5. **`directory_people` has RLS disabled** (Sprint 2: "no RLS"). It's outside this
   migration's lane, but the same anon-key exposure applies to it. Worth a one-line
   follow-up migration.
