# Acceptance checklist — Hockey ops player directory (Sprint 1)

**App under test:** TanStack Start player directory (local dev, `npm run dev`, http://localhost:3000)
**Date:** 2026-09-10
**Tester:** sangchunahn
**Commit tested:** `89cf4c4`
**Overall status:** **ready**

## Summary for hockey ops

- Passes: 12 / 12
- Fails: 0
- Blockers for demo: none

Every criterion in [`docs/requirements-brief.md`](requirements-brief.md) is met.
The directory is demoable: staff can open a bookmarked player URL cold and see
that player's name/number on the first screen, filters survive a reload, and
bad links recover instead of crashing. Real data (Supabase) and visual polish
remain out of scope for Sprint 1 — see [handoff](#gaps--out-of-scope-not-fails).

## How to re-run

1. From `C:\Users\sangc\src\proj\hockey-player-directory`, run `npm run dev`.
2. Open the local URL the terminal prints (http://localhost:3000).
3. Walk each row below. To check server-rendering, use **View Page Source**
   (Ctrl+U) — not Inspect — and search for a seed player name, or throttle to
   Slow 3G in devtools and reload: real content is in the first document, not
   after a spinner. (Evidence below was captured with `curl`, which sees the
   same raw server HTML before any client JS runs.)

## Criteria (from docs/requirements-brief.md)

| ID | Criterion | How tested | Result | Evidence | Notes / next action |
|----|-----------|------------|--------|----------|---------------------|
| A1 | Home `/` loads with directory content, not a blank shell | Open `/` | **pass** | HTTP 200. First HTML has `<h1>Hockey Ops Player Directory</h1>`, a "Featured players" list, and stat tiles (`12` players / `6` games / `4` upcoming) | |
| A2 | Players index reachable from nav and lists seed players | Open `/players`; click "Players" in nav | **pass** | HTTP 200. First HTML contains all 12 seed names (`Riley Chen`, `Marcus Boivin`, `Sam Ortiz`, `Henrik Aalto`, `Beau Lantz`, …) with sweater numbers | |
| A3 | Player detail is bookmarkable: direct cold load of `/players/$playerId` works | Paste `/players/12` as a fresh request (no prior navigation) | **pass** | HTTP 200. First HTML: `#12 Alex Mercer`, `Valley Glaciers`, position `F`, status `Active` — all present before client JS | Simulates a shared/bookmarked link opened in a new session |
| A4 | Unknown player id shows a clear not-found state (not blank, not a crash) | Open `/players/9999` | **pass** | HTTP **200** with `Player not found` / "No roster entry matches id 9999" (`NotFoundPlayer` component) + link back to `/players` | Matches brief Locked decision: unknown id → 200 empty state, never 404 |
| A4b | Invalid player id is rejected safely | Open `/players/%20` (whitespace id) | **pass** | HTTP 307 → `/players` (roster list). No crash, no fake sheet | `params.parse` returns `false` |
| A5 | Games index loads and is linkable | Open `/games` | **pass** | HTTP 200. First HTML: opponents `Toronto`, `Boston`, `Lakeside`, `River City`, `North Bay` with dates and `Final` / `Scheduled` | |
| A6 | Players filter params restore on reload | Open `/players?position=G` in a fresh tab | **pass** | HTTP 200. First HTML shows only the two goaltenders (`Sam Ortiz`, `Henrik Aalto`) — filter applied server-side, survives reload | |
| A6b | Games filter params restore on reload | Open `/games?team=TOR` in a fresh tab | **pass** | HTTP 200. First HTML shows only Toronto games | |
| A7 | Invalid search params do not crash the page | Open `/players?position=NOPE&status=BAD` | **pass** | HTTP 307 → `/players` (both values fell back to defaults, then stripped). Page renders normally | Validator never throws |
| A7b | Invalid games search recovers | Open `/games?date=yesterday` | **pass** | HTTP 307 → `/games` (invalid date dropped). Page renders normally | |
| A8 | Server-rendered first content: seed name in the initial HTML | `curl` / View Source on `/players` and `/players/12` | **pass** | `Alex Mercer` found in the raw HTML of both `/players` and `/players/12` before any client fetch. Cross-checked against [`docs/ssr-verification-notes.md`](ssr-verification-notes.md) | |
| A9 | Cross-links between players and games do not 404 | Follow player-detail → games link; check reverse context | **pass** | `/players/12` HTML contains `href="/games?playerId=%2212%22"`; `/games?playerId=12` → 200 with "Schedule context for #12 Alex Mercer" + "Back to player" link. `/games?playerId=9999` → graceful "not in the directory" note | |
| A10 | Main nav reaches Home, Players, Games from every page, with active highlight | Inspect nav on `/`, `/players`, `/players/12`, `/games` | **pass** | `<nav aria-label="Primary">` with Home / Players / Games links present on every page. Active link gets `border-sky-600 font-semibold` server-side; Players stays active on `/players/12` | |

## Gaps log (fails only)

| ID | What failed | Suspected area | Minimal fix idea |
|----|-------------|----------------|------------------|
| — | none | — | — |

## Gaps / out of scope (not fails)

Carried to the next sprint per [`docs/requirements-brief.md`](requirements-brief.md):

- Real data source — the 12 players / 6 games are seed data in
  `src/data/hockeySeed.ts`. Supabase / live feeds are a later sprint.
- Authentication, roster editing, sorting/pagination.
- Visual design polish — layout is plain Tailwind.
- `?playerId=` on `/games` serializes as `%2212%22` (JSON-encoded) — cosmetic,
  the link and reload both work.

## Sign-off

- [x] Checklist matches the criteria in `docs/requirements-brief.md`
- [x] Bookmark test done as a fresh cold request (`/players/12`, no prior nav)
- [x] SSR / first-document check recorded (A8, seed name in raw HTML)
- [x] Fails (if any) have next actions for handoff — none this sprint

**Ready for stakeholder handoff step?** **yes** — all 12 acceptance criteria
pass with evidence; only out-of-scope items remain.
