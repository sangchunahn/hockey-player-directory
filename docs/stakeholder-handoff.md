# Stakeholder handoff — Hockey Ops Player Directory (Sprint 1)

**Audience:** Hockey operations leads, and whoever plans the next sprint
**App:** Player directory (TanStack Start), running on a developer machine
**Repository:** https://github.com/sangchunahn/hockey-player-directory (private — see `docs/repo-setup.md`)
**Date:** 2026-09-10
**Status:** Sprint 1 complete — all 12 acceptance checks pass (`docs/acceptance-checklist.md`)

---

## Delivered now — what staff can do

Every item here was checked in the browser this sprint:

- **Open the app and immediately see directory content.** The home page shows
  the roster and game counts and a short featured-players list on the *first*
  screen — no blank page, no spinner wait. This matters on arena wifi.
- **Browse the roster and the schedule.** A "Players" page lists all players
  with numbers and positions; a "Games" page lists matchups with opponent,
  date, and final/scheduled status. Both reachable from the top navigation on
  every page, which also shows which section you're in.
- **Open, bookmark, and share a specific player's page.** Each player has a
  stable link (for example `/players/12`). Paste that link into a chat or save
  it as a bookmark, open it later or on another device, and the same player's
  details load right away.
- **Filter a view and share the filtered link.** On Players you can narrow by
  position or roster status; on Games you can narrow by opponent or date. The
  filter is in the link itself, so a refreshed or shared link keeps the same
  view.
- **Get a clear message for a bad link.** Opening a player link that doesn't
  exist shows a plain "player not found" screen with a way back to the roster —
  not a broken page or an error dump.
- **Jump between a player and the schedule.** From a player's page there's a
  link into Games that shows "you came from this player" context, with a link
  back.

## Known limitations — please don't assume these work yet

- **The data is sample data, not the live club roster.** The 12 players and
  6 games are realistic placeholders built into the app. There is no connection
  to a real roster database yet.
- **There is no staff login.** Anyone who can reach the app can see every page.
  Access control (Supabase Auth) is next-sprint work.
- **There is no shared web address yet.** Sprint 1 was verified on a developer
  machine only. A public URL (Vercel) is a later step.
- **There are no automated tests yet.** Checks this sprint were done by hand and
  written up in `docs/acceptance-checklist.md`. Automated test coverage is a
  next-sprint recommendation.

## How to try it (high level)

1. Clone the repository above, install dependencies, and start the local dev
   server (the exact commands are in `docs/scaffold-notes.md`).
2. In a browser, open the home page, then Players, then a player's page, then
   Games.
3. Copy a player's link, open it in a new private/incognito window, and confirm
   the player's details appear straight away without visiting the home page
   first.

Pass/fail detail for each check is in `docs/acceptance-checklist.md`; the
server-rendering evidence is in `docs/ssr-verification-notes.md`.

## Recommended next sprint

1. **Connect live data.** Replace the sample-data loaders with a real
   Supabase-backed data source (using database functions where list/filter
   logic belongs in the database, and TanStack Query on the client where it
   helps). The page code is already shaped for this — only the data source
   changes.
2. **Add staff login.** Put staff-only views behind Supabase Auth with clear
   logged-out behavior.
3. **Add automated checks.** Unit tests (Vitest) for the id/filter validation
   helpers, and a browser smoke test (Playwright) for the bookmark and
   first-paint paths, run automatically on every push (GitHub Actions).
4. **Deploy.** Publish a preview/production URL on Vercel and re-run the
   acceptance checklist against that live URL.

## One-line summary for leadership

Staff can already open bookmarkable, shareable player and game pages that show
directory content on the first screen; the next sprint should connect the live
roster, add login, add automated tests, and put it on a shared web address.

---

### Mini-glossary (only the terms used above)

- **First paint / server-rendered:** the page arrives from the server with its
  content already in it, so staff see data immediately instead of a spinner.
- **Seed / sample data:** believable fake data built into the app to prove the
  pages work before the real database is connected.
