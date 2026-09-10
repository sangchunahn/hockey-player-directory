# Decisions log — Sprint 1 (engineering)

For a developer joining next sprint. Short by design — the supporting docs hold
the detail. Expand an entry only when a choice would surprise the next person.

Supporting docs: `docs/route-map.md`, `docs/params-design-notes.md`,
`docs/search-params-notes.md`, `docs/ssr-verification-notes.md`,
`docs/scaffold-notes.md`, `docs/acceptance-checklist.md`.

---

## D1 — Stack baseline

- **Decision:** App foundation for the whole project.
- **Choice:** TanStack Start (Vite + React + TypeScript + Tailwind v4),
  scaffolded with the official `@tanstack/cli` (`--no-examples`,
  `--no-toolchain`).
- **Why:** File-based type-safe routing plus built-in SSR match the sprint
  goals directly, and it leaves a clean path to TanStack Query + Supabase +
  Vercel. Tailwind v4 is CSS-first — no `tailwind.config.ts`. See
  `docs/scaffold-notes.md`.

## D2 — Route tree matches ops jobs

- **Decision:** Which URLs exist.
- **Choice:** Exactly four — `/` (home), `/players`, `/players/$playerId`
  (dynamic), `/games`. Static routes for the list hubs, one dynamic route for
  player detail.
- **Why:** Ops need a shareable link *per player*; the list hubs map to "browse
  the directory". No other routes were added. See `docs/route-map.md`.

## D3 — Root layout: `component` + `shellComponent`

- **Decision:** Where shared chrome lives.
- **Choice:** `src/routes/__root.tsx` keeps the CLI's `shellComponent` (HTML
  document) and adds a root `component` that renders the header, `<AppNav />`,
  and `<Outlet />`.
- **Why:** One place for shared nav; the shell/component split is the current
  TanStack Start pattern and shouldn't be downgraded to satisfy a checklist.

## D4 — Type-safe path param for player id

- **Decision:** How a player id enters the app.
- **Choice:** `createFileRoute('/players/$playerId')` with `params.parse` calling
  a shared helper (`src/lib/playerParams.ts`); an invalid id (empty/whitespace)
  returns `false` and the router redirects to `/players`.
- **Why:** Bookmarks must not depend on accidental string shapes, and a bad id
  should fail predictably rather than render a blank sheet. See
  `docs/params-design-notes.md`.

## D5 — Unknown-but-valid id returns HTTP 200

- **Decision:** What `/players/9999` (well-formed, no such player) does.
- **Choice:** The loader returns `null`; the route renders `NotFoundPlayer` at
  **HTTP 200**, not a 404 or a thrown error.
- **Why:** Locked decision in `docs/requirements-brief.md` — staff following an
  old bookmark should get a friendly, recoverable screen inside the normal
  layout.

## D6 — Schema-validated search params for filters

- **Decision:** Where directory filters live and how they're validated.
- **Choice:** `validateSearch` on `/players` and `/games` backed by
  `src/lib/searchSchemas.ts`; validators never throw — bad values fall back to
  documented defaults. `stripSearchParams` middleware keeps default values out
  of the URL. `/games` also carries a context-only `playerId`.
- **Why:** Refresh and share keep the same view; a pasted/edited junk query
  gets a safe fallback (verified: `?position=NOPE` → `/players`). See
  `docs/search-params-notes.md`.

## D7 — Server loaders with seed data for first paint

- **Decision:** What staff see before client JS runs.
- **Choice:** Each route's `loader` calls a named helper in
  `src/server/directoryLoader.ts` (`listPlayers` / `getPlayerById` /
  `listGames` / `directorySummary`) that reads typed arrays in
  `src/data/hockeySeed.ts`. Validated search values are passed straight into
  the list helpers. No client-only `useEffect` fetch for the main content.
- **Why:** Arena wifi makes spinner-only first loads painful. Seed data proves
  SSR now; a later sprint swaps the helper bodies for Supabase with no route
  changes. See `docs/ssr-verification-notes.md`.

## D8 — Navigation and empty-state polish

- **Decision:** How staff move around and how dead ends look.
- **Choice:** Shared `AppNav` with type-safe `<Link>` (never raw `<a href>`)
  and an active-section highlight from the current path; dedicated
  `NotFoundPlayer` component; calm empty states on filtered lists;
  bidirectional player↔games context links.
- **Why:** A directory that 404s silently or dumps you on a blank page is not
  usable on the bench between periods.

## Explicit non-goals this sprint

Live Supabase reads/writes, Supabase Auth, Vitest/Playwright, CI, and a
production deploy. All are in the next-sprint recommendation in
`docs/stakeholder-handoff.md`.
