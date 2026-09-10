# SSR verification notes (Sprint 1)

How the data flows: each route declares a `loader` that calls a helper in
`src/server/directoryLoader.ts`, which reads the typed seed arrays in
`src/data/hockeySeed.ts`. TanStack Start runs the loader **on the server** for
the first request, so the directory content is in the initial HTML. The route
components read it with `Route.useLoaderData()` — there is no client-only
`useEffect` fetch for the main list/detail content.

## First-paint checks

Tested with `curl` against `npm run dev` (raw server HTML = the same as
browser "View Page Source", before any client JS runs).

| Route | URL tested | HTTP | Real content in the first HTML? | Notes |
|-------|------------|------|--------------------------------|-------|
| Home | `/` | 200 | Yes | Summary counts (12 players / 6 games / 4 upcoming) + "Featured players" list incl. `Alex Mercer`, `Riley Chen` |
| Players list | `/players` | 200 | Yes | 12 seed names + numbers (`#12 Alex Mercer`, `#30 Sam Ortiz`, …) |
| Players list (filtered) | `/players?position=G` | 200 | Yes | Server-filtered to `Sam Ortiz`, `Henrik Aalto` only — filter applied before paint |
| Player detail | `/players/12` | 200 | Yes | `#12 Alex Mercer`, position/sweater/team/status all in first HTML |
| Player detail (unknown id) | `/players/9999` | 200 | Yes | "Player not found" / "No player has id 9999" — **HTTP 200, no crash, no 404** (matches requirements-brief Locked decisions) |
| Player detail (invalid id) | `/players/%20` | 307 → `/players` | n/a | whitespace id rejected by `params.parse`, redirected to the list |
| Games | `/games` | 200 | Yes | `vs Toronto`, `@ Boston`, dates, Final/Scheduled |
| Games (filtered) | `/games?team=TOR` | 200 | Yes | Server-filtered to Toronto games only |

## Requirements-brief criteria

- [x] No spinner-only / empty-shell directory pages — every list route ships
      rows in the first HTML.
- [x] Player detail bookmark (`/players/12`) shows identity content on a cold
      load without waiting on a client fetch.
- [x] Unknown player id → friendly empty state at HTTP 200 (not 404, not a
      thrown error).
- [x] Existing `playerId` path-param validation (`src/lib/playerParams.ts`) and
      search validation (`src/lib/searchSchemas.ts`) are unchanged; validated
      search values are passed straight into `listPlayers` / `listGames`.
- [ ] Real data source — still **stubbed**. `src/data/hockeySeed.ts` holds
      12 players and 6 games. Supabase / live feeds are a later sprint.

## Agent follow-ups I needed

- None for SSR itself. Adding loaders made `/players` and `/games` search
  params required on every cross-route `<Link>`; those links now pass the
  default search object and `stripSearchParams` keeps the URLs clean.

## Risks / next sprint

- Replace `directoryLoader` bodies with real data-source calls (e.g. Supabase
  RPC) when auth and live data land — signatures and route code stay the same.
- `directoryLoader.ts` currently imports the seed module directly; when it
  calls a real backend it should become a proper server function so no data
  logic is bundled to the client.
- Not-found state is functional but minimal; a polished empty-state pass is
  the next step.
