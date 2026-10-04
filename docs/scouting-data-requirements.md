# Scouting data requirements — Northline Hockey

**Date:** 2026-10-03
**Sprint:** 3 — scouting data layer
**Status:** Requirements only. No tables, SQL, or TypeScript in this file — later
steps design those and must trace back to the sections below.
**Builds on:** Sprint 1 directory (`docs/requirements-brief.md`) and the Sprint 2
server boundary (`docs/sprint-2-topic-1-handoff.md`).

---

## The story in one paragraph

Northline Hockey scouts watch games and record what individual players do in them.
They need lists of players, games, and observed events that stay **correctly joined**
(every event is tied to the right player and the right game) and **correctly filtered**
(asking for one player in one game returns exactly that), and they need per-player
totals across many games. The database schema will change over the season — columns
get renamed, fields get added — and the data layer must catch those changes before
scouts see broken lists, not after.

---

## 1. Actors and goals

| Actor | Goal | What they need from the data |
|-------|------|------------------------------|
| **Scout** | Record and review observations about players, tied to the games they happened in | Player and game lists to pick from; events linked to exactly one player and one game; the ability to add an event and correct its type or note without affecting any other row |
| **Scout** (reviewing) | Compare players across many games before writing an evaluation | A per-player summary — event counts by type across games — without reading every event row |
| **Ops / data steward** | Keep player, game, and event data consistent while the schema evolves | Stable unique ids for every entity, links that cannot point at nothing, and type checks that fail loudly when a column a query depends on is renamed or removed |

Both actors use the existing hockey ops app. Neither needs a separate admin tool this
sprint.

### Out of scope for this sprint

- Public fan pages, ticketing, payments, or merchandise
- Live video, video clips, or video tagging
- Fantasy, betting, or prediction features
- Live NHL or third-party stat feeds — scouts enter events themselves
- Login screens, user accounts, and per-scout permissions (who recorded an event is
  **not** tracked until auth exists)
- Deleting players, games, or events (corrections are updates; deletion is a later
  decision because it affects history and totals)
- Charts or visual dashboards — the aggregate is a list of numbers, not a graphic

---

## 2. Core entities and relationships (plain language)

### Player
A skater or goalie that Northline scouts. Each player has a **unique id that never
changes**, even if their name is corrected. Scouts recognise and filter players by
**display name**, **position** (forward, defense, goalie), and a **team or
organisation label** (the club they currently play for). A sweater number is useful for
display but is **not** an identifier — numbers change between teams.

### Game
A single contest played on a **date** between two sides. Each game has a **unique id**.
Scouts recognise a game by its date and the two sides (for example "Northline vs.
Lakeside, 2026-10-14"). A game exists before any events are recorded against it.

### Event
One thing a scout observed a specific player do in a specific game — a goal, an assist,
a shot, a hit, a penalty, or a general scouting note. Each event has a **unique id**, an
**event type** drawn from a fixed list (not free text), an optional **period**, and an
optional **note** written by the scout.

### How they connect

- **An event belongs to exactly one player and exactly one game.** It cannot exist with
  either link missing, and it cannot point at a player or game that does not exist.
- **One player has many events** (across many games).
- **One game has many events** (about many players).
- A player and a game are connected *only through events* — there is no separate
  "player played in game" record this sprint.
- Lists such as "events for player X in game Y" must use these id links, **never**
  matching on a player's name text. Two players can share a name; a name can be
  corrected.

### Relationship to data that already exists

- `src/data/hockeySeed.ts` (Sprint 1) holds demo players and games for the public
  directory pages.
- The Supabase table `directory_people` (Sprint 2) holds directory rows for players
  and staff.
- **Open question for the schema step:** whether scouting players are the same records
  as `directory_people` rows or a separate table that references them. This brief does
  not decide it — but whichever is chosen, a player must have exactly one id that every
  event uses.

---

## 3. Filters and scout views

Every filter below is **optional**. An empty filter means "all" for that dimension, and
combining filters narrows the result (AND, not OR).

| # | View | Filters | Default order |
|---|------|---------|---------------|
| V1 | **Player list** | position; team/org label | display name, A→Z |
| V2 | **Game list** | date range (from / to) | date, newest first |
| V3 | **Event list** | player; game; **player and game together**; event type | game date newest first, then period |
| V4 | **Per-player summary** (aggregate) | optional date range; optional position | display name, A→Z |

**V4 in detail:** one row per player showing that player's event **counts by type**
(goals, assists, shots, hits, penalties, notes) and the **number of distinct games**
they have events in. It must be computed as a set — across all matching events at
once — not by the browser downloading every event row and adding them up.

### Writes scouts and ops need

| Write | Who | Rule |
|-------|-----|------|
| Create a player | Ops / data steward | Gets a new unique id; name, position, and team label are required |
| Update a player | Ops / data steward | Changing a name or team label must not break any existing event links |
| Create an event | Scout | Must reference an existing player **and** an existing game; type must come from the fixed list |
| Update an event | Scout | May correct the type, period, or note; changing one event never changes another |

All reads and writes go through the app's **typed data layer on the server** — never
hand-written query strings in UI components, and never the privileged database key in
the browser (the Sprint 2 boundary stays in force).

---

## 4. Success criteria (measurable)

Each criterion is written so it can **fail**. Checks are run against seed data and the
built app once schema and queries exist.

1. **Join integrity.** Every row returned by V3 shows a resolvable player name *and*
   game (date + sides). Attempting to create an event for a player id or game id that
   does not exist is **rejected by the database**, not just by the form.
2. **Filter fidelity.** For a chosen player and a chosen game in seed data, V3 with
   both filters returns *only* events where both match, and the row count equals a
   hand count of the seed rows. Clearing a filter widens the list; an empty filter
   returns all rows for that dimension.
3. **Schema-change safety.** Reads and writes use types generated from the database
   schema. If a column a query depends on is renamed in the schema and the types are
   regenerated, the project's **typecheck fails** and names the broken file — before
   the change can be deployed.
4. **Aggregate correctness.** V4 is produced by a **single server-side call**. For at
   least two seed players, its per-type counts and distinct-game count equal totals
   counted by hand from the seed events. The browser receives one summary row per
   player, not the raw event list.
5. **Write isolation.** Updating one event's note or type leaves every other event row
   unchanged (verified by re-reading the list before and after).
6. **Cache freshness.** After a successful create or update, the affected list (V3) and
   the summary (V4) show the new values **without a manual page reload**. A failed write
   leaves the previous values on screen and shows an error.
7. **Safe errors.** An invalid filter value (unknown event type, malformed date)
   returns a validation message or falls back to "all" — never a crash page and never a
   raw database error shown to the scout.
8. **Boundary preserved.** After these changes, the built client bundle still contains
   no service-role key and no direct database client, matching the Sprint 2
   secret-hygiene checks.

---

## 5. Glossary for later steps

| Term | Meaning in this project |
|------|-------------------------|
| **Entity** | A real-world thing we store as its own table: player, game, event |
| **Id** | A unique value that identifies one row and never changes, even when names do |
| **Join** | Combining rows from related tables using their id links |
| **Foreign key** | The database rule that makes an event's player/game link point at a row that really exists |
| **Filter** | Narrowing a list by values a scout chooses; empty means "all" |
| **Aggregate** | A count or total computed across many rows at once (e.g. goals per player) |
| **RPC** | A named database function the server calls to compute something like the per-player summary |
| **Typed data access** | Query and write helpers whose inputs and outputs use TypeScript types generated from the schema |
| **Cache invalidation** | Telling the app a stored list is out of date so it re-fetches after a write |

---

## 6. Source of truth

This file is the requirements source of truth for **Sprint 3**. Schema notes,
migrations, query modules, the aggregate RPC, cache-invalidation design, and the final
acceptance checks must each trace back to a numbered item in sections 1–4 (for example
"implements V3, satisfies criterion 2").

If a later step needs something not listed here — a new filter, a delete, a new event
type — **update this brief first**, then build it. If an agent proposes scope outside
section 1's out-of-scope list, that proposal is rejected until the brief changes.
