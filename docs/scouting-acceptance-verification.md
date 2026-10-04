# Scouting acceptance verification — Northline Hockey

**Date:** 2026-10-04
**Verifier:** sangchunahn (walk-through driven with Claude Code in the in-app browser)
**App routes checked:** `/scouting/players`, `/scouting/events`, `/scouting/aggregates`
**Sources:** `docs/scouting-data-requirements.md` (criteria 1–8), `docs/scouting-cache-invalidation-map.md`

## Test setup

- **App:** production build (`npm run build`, then `node .output/server/index.mjs` on
  :3000) against Supabase project `bsjodruzecdaymnxjade`. `npm run dev` fails on this
  machine with a Nitro "Vite environment ssr is unavailable" error, a known issue since
  Sprint 2 that is unrelated to scouting.
- **Env:** `.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only. It
  is gitignored, and the service-role key is blank.
- **Database access:** temporary "smoke:" RLS policies, pasted in the dashboard SQL
  Editor (owner decision: not a repo migration). The anon role can read players, games
  and events, and can insert and update events. There is no delete, and players and
  games are read-only. Remove these policies when Auth lands.
- **Seed (hand counts):** 5 players, 3 games, 10 events.
  - **Avery Cole:** 2 goals, 2 shots, 1 note (5 events) across 3 games.
  - **Blake Dunn:** 1 hit, 1 penalty, 1 assist (3 events) across 2 games.
  - **Casey Fox:** 1 note in 1 game.
  - **Drew Gray:** 1 shot in 1 game.
  - **Emery Hale:** no events.
- **Write made during this pass:** a goal for Drew Gray, 2026-10-03, period 2. The
  database now holds 11 events.
- **Evidence method:** I read rendered page text after each action. The Supabase
  requests behind each action came from the browser's resource timing, recorded before
  and after each step.

## 1. Joined and filtered reads

| ID | Criterion | How to check | Result | Evidence |
|----|-----------|--------------|--------|----------|
| R1 | Players list loads from typed query helpers, not ad-hoc strings in the route | Open `/scouting/players`; read `players.tsx` imports | **Pass** | All 5 seeded players render name A→Z with Pos, Team and #. The only request is `GET /rest/v1/players?select=*&order=display_name.asc` (from `listPlayers`). `players.tsx` imports only `usePlayers` from `hooks.ts`: no Supabase client, `.from` or `fetch`. |
| R2 | Event board shows joined player and game context (req. 1) | Open `/scouting/events` | **Pass** | All 10 rows show player name and position (e.g. "Avery Cole (F)") plus game date and sides ("2026-09-20 · Northline vs Harbor"). One request joins through both FKs: `scouting_events?select=*,player:players!scouting_events_player_id_fkey(…),game:games!scouting_events_game_id_fkey(…)`. Order is game date newest first, then period, per V3. |
| R3 | Filters narrow the list through the API (req. 2) | Players: Position=Forward, then Team=Northline. Events: Player=Avery Cole + Game=2026-09-20 | **Pass** | Forward gave 3 rows (Avery, Drew, Emery) via `position=eq.F`. Adding Northline gave 2 (Avery, Emery) via `position=eq.F&team_label=eq.Northline`. Avery + 09-20 gave exactly 3 events (goal p1, shot p1, shot p2), equal to the hand count. Each filter was a new server request, not hiding rows in the browser. |
| R4 | Empty / no-match state is safe | Team="Nowhere"; Events: Avery + 09-20 + Type=penalty | **Pass** | Shows "No players match these filters." and "No events match these filters yet." No blank screen and no crash. The request with `team_label=eq.Nowhere` returned 0 rows. |

## 2. RPC aggregate correctness

| ID | Criterion | How to check | Result | Evidence |
|----|-----------|--------------|--------|----------|
| A1 | Summary uses the RPC helper, not a client loop (req. 4) | Open `/scouting/aggregates`; read `aggregates.tsx` | **Pass** | Exactly one request: `POST /rest/v1/rpc/player_event_summary`, with no event download. The route imports only `usePlayerEventSummary`, and the table prints RPC fields with no arithmetic. |
| A2 | Totals match a manual count for known players | Compare rows to the seed hand counts | **Pass** | Every count matched the hand counts:<br>• Avery: G 2, A 0, Shots 2, Notes 1, Events 5, Games 3<br>• Blake: A 1, Hits 1, Pen 1, Events 3, Games 2<br>• Casey: Notes 1, Events 1, Games 1<br>• Drew: Shots 1, Events 1, Games 1<br>Emery (no events) is absent, as designed. Filters: Position=D shows only Blake. Sep 20–27 shows Avery 4/2 (Oct 3 note excluded), Blake 3/2, Drew 1/1 and no Casey, all matching hand counts. |
| A3 | Summary updates after a new event for that player | Log Drew's goal on `/scouting/events`, then nav-link back to the summary | **Pass** | Drew went from G 0 / Events 1 / Games 1 to **G 1 / Events 2 / Games 2**. Returning made one `rpc/player_event_summary` request. There was no page reload: in-app links, and the navigation entry stayed the original URL. |

## 3. Mutation + cache freshness

| ID | Criterion | How to check | Result | Evidence |
|----|-----------|--------------|--------|----------|
| C1 | Create path uses the typed mutation hook | Submit "Log event": Drew Gray · 2026-10-03 · goal · period 2 | **Pass** | `events.tsx` calls `useCreateScoutingEvent` → `createScoutingEvent`. The insert went out as `POST /rest/v1/scouting_events?select=*`. The UI showed "Saved. The board and summaries have refreshed." |
| C2 | After the write, lists in the invalidation map refresh without a reload (req. 6) | Watch the board right after saving; then open the summary | **Pass** | With no reload, the board showed the new row "2026-10-03 · 2 · Drew Gray (F) · goal" in its sorted place, from one board refetch. The summary (off screen during the save) refetched when opened and showed Drew's new totals (A3). This matches the map: `events()` filtered by the saved row, plus `aggregates()`. |
| C3 | Unrelated keys are not cleared | Record every request between Save and the refreshed board | **Pass** | Only 2 requests: the insert and the board refetch. The roster (`players`) and game list (`games`), loaded on the same page for the pickers, were **not** refetched. That matches the map's "deliberately NOT invalidated" table. |

## 4. Other requirement criteria

| ID | Criterion (requirements §4) | Result | Evidence |
|----|-----------------------------|--------|----------|
| E1 | Safe errors (req. 7) | **Pass** | Logging a `note` event with empty text showed `alert: "A note event needs note text."`. **Zero** requests reached Supabase (pre-flight check), and the board kept its rows. Earlier, with no `.env.local`, each page showed a readable setup message instead of a crash. |
| E2 | Join integrity at the database (req. 1) | **Pass** | The `scouting_events` FKs reject unknown ids. Verified against the same migrations in local Postgres: an insert with a missing player id failed with `23503`. The form only offers existing players and games. |
| E3 | Write isolation (req. 5) | **Waived (live)** | The smoke UI has no "edit event" form, so this wasn't clicked. Evidence instead: `updateScoutingEvent` updates by primary key `.eq('id', …)` with `.single()`. The local Postgres check showed the anon update touched exactly 1 row, and mocked tests showed one `eq('id')` per update. A live check is due when an edit screen exists. |
| E4 | Boundary preserved (req. 8) | **Waived (partial)** | **Pass:** the built client bundle (`.output/public`) contains no service-role key (checked for `service_role`/`SERVICE_ROLE`). **Deviation:** the bundle does contain the anon Supabase client (`hooks-*.js`), because the hooks call it from the browser, as the Step 4/10 design required. RLS is the only gate, and the "smoke:" policies are open. Follow-up: move reads and writes behind server functions, or tighten RLS when Auth lands. |

## 5. Typed-safety regression note (no live rename required)

**What should break if a column used by `queries.ts` or the RPC were renamed in
Postgres and types were not regenerated?**

| Check | Notes |
|-------|-------|
| Which modules import `src/types/database.ts` for those fields? | `src/lib/supabase/client.ts` (`createClient<Database>`), `queries.ts` (Row types, filters), `mutations.ts` (Insert/Update payloads) and `rpc.ts` (`Functions['player_event_summary']`). Hooks and routes inherit those types through the helpers' return types. |
| Compile time, runtime, or both? | **Without regenerating:** nothing fails at compile time. The stale types still list the old name, so the failure is at **runtime**. PostgREST rejects the column (e.g. a `42703` "column does not exist" error), the helper throws `ScoutingQueryError`, and the page shows its error state. **After regenerating:** `tsc` fails. I re-proved this on 2026-10-04 by renaming `display_name` and `goal_count` in the generated types: `tsc` reported 14 errors in mutations.ts (5), queries.ts (3), events.tsx (3), aggregates.tsx (2) and players.tsx (1), then passed again once restored. **Cast away (`as any`):** compile-time protection is lost, so it fails only at runtime, which is why casts are banned in `docs/scouting-data-access-api.md`. |
| What regenerates types? | Apply the migration, then run `npm run gen:types` (`scripts/gen-types.mjs`, pinned Supabase CLI 2.119.0). It refuses to write if a table or `player_event_summary` is missing. Commit the regenerated types in the same commit as the migration (`docs/typegen-notes.md`). |

**Summary:** The generated `Database` type is the contract between Postgres and every
scouting module. A rename is caught by `tsc` only once types are regenerated. That's
why the rule is "apply migration → `npm run gen:types` → commit both together", and
why casts are forbidden. Until then the failure surfaces as a readable runtime error
on the page, not a silent wrong value.

## 6. Overall gate

| Gate | Status |
|------|--------|
| All R* criteria Pass or Waived with reason | **Yes**: R1–R4 Pass |
| All A* criteria Pass or Waived with reason | **Yes**: A1–A3 Pass |
| All C* criteria Pass or Waived with reason | **Yes**: C1–C3 Pass |
| Other requirement criteria | E1–E2 Pass; E3 Waived (no edit UI yet); E4 Waived (anon client in bundle; service-role absent) |
| Typed-safety section completed | **Yes** (rename probe re-run 2026-10-04) |
| Ready for stakeholder handoff step | **Yes**, with two caveats: the temporary open "smoke:" RLS policies, and the E4 boundary follow-up |

## 7. Fixes applied during this pass

| Fail ID | Targeted change (file + brief description) | Re-test result |
|---------|---------------------------------------------|----------------|
| — | No row failed, so no application code changed. Setup only, nothing committed: created `.env.local` (anon key fetched with the logged-in CLI and never printed), applied the "smoke:" RLS policies and seed in the dashboard. | n/a |

## Sign-off

- [x] Verification matches Northline success criteria in `docs/scouting-data-requirements.md` (1, 2, 4, 6, 7 Pass live; 3 by rename probe; 5 and 8 Waived with reasons)
- [x] Cache behavior matches `docs/scouting-cache-invalidation-map.md` (events + aggregates refreshed; roster and games untouched)
- [x] No known Fail rows left unresolved
