# Hockey Ops Player Directory — Requirements Brief (Sprint 1)

## Overview

Hockey operations needs a **player directory** that staff can open on arena
wifi and use immediately. Real directory content must appear on **first paint**
(the first HTML the browser draws), not only after a long client-side loading
spinner. Every player must have a **linkable, bookmarkable** page URL that a
staffer can copy, paste into chat, and reopen later.

This sprint delivers a TanStack Start skeleton only: a route tree, validated
path and search params, and **server-rendered** page shells that already
contain seed directory content. A real database, authentication, and live
game feeds are later sprints. Nothing in this brief requires a feature the
routing/SSR skeleton cannot build.

## Actors and goals

| Actor | Goal | Success looks like |
| --- | --- | --- |
| Hockey ops staff | Open the directory on weak arena wifi and see players/games right away | The first response HTML already lists directory content (no blank shell, no spinner-only screen) |
| Hockey ops staff | Share or bookmark one player | A URL like `/players/12` opens that player's page directly and survives a browser restart |
| Coach / scout (same app, same staff login later) | Browse the games list and jump back to players | `/games` renders a game list and the primary nav reaches Players and Home |
| Future developer (you, next sprint) | Implement without re-guessing scope | This brief + the acceptance criteria below stay the checklist |

## Route map (the four routes for this sprint — no more)

| Route name | URL pattern | Kind | One-line purpose |
| --- | --- | --- | --- |
| Home | `/` | Static | Landing page: app title, one-line intro, links into Players and Games |
| Players index | `/players` | Static | List player names (seed data) so staff can scan the roster |
| Player detail | `/players/$playerId` | Dynamic (path param) | Show one player; the URL is bookmarkable / shareable |
| Games index | `/games` | Static | List games (seed data), each showing the opponent |

Notes for the implementer:

- `$playerId` is a **path param** — its value is part of the URL path
  (`/players/12`), not a query string. It is named `playerId` everywhere.
- Filters that come later (position, team, "upcoming only") belong in
  **search params** — the `?key=value` part — and each must have a default and
  safely reject or coerce invalid values instead of crashing the page.
- The primary navigation must reach Home, Players, and Games from every page.

## Data shown on first paint (server-rendered)

For Sprint 1 the content may come from a **seed / demo data module loaded on
the server** — it does not have to be a live database yet — as long as staff
see real-looking directory rows in the very first HTML document.

| Page | Must appear in the first HTML (not only after a spinner) |
| --- | --- |
| Home | App title + one-line intro + working links to `/players` and `/games` |
| Players index | A list of at least a few player names from seed data |
| Player detail | The `playerId` from the URL, plus the player's name and team when the id is known; a clear "player not found" message when it is not |
| Games index | A list of at least a few games from seed data, each with an opponent |

## Type-safe links and params

Stated in plain language so a beginner can verify each one in the browser:

- **Internal links use the router's type-safe link helper**, never hand-typed
  strings. If a route name is misspelled, the app should fail to compile rather
  than ship a dead link.
- **`playerId` is validated** before the page renders. For this sprint a valid
  id is a positive whole number (e.g. `1`, `12`, `27`). `/players/abc` or
  `/players/-3` is treated as "not found", not a crash.
- **Unknown-but-valid ids render a friendly empty state** with HTTP 200 — e.g.
  `/players/9999` shows "No player with id 9999" inside the normal layout.
- **Search params (when added later) are validated with defaults.** An unknown
  or malformed value falls back to the default; it never throws.

## Out of scope (this sprint)

Parked here on purpose so agent prompts in later steps stay bounded:

- Real authentication, staff login, or role permissions
- A real database (Supabase, etc.) — seed data only this sprint
- Live NHL / external game feeds or any paid API
- Creating, editing, or deleting players or games in the UI
- Search, filtering, sorting, and pagination (route shape is reserved, behavior is later)
- Payments, messaging, notifications, native mobile apps
- A finished visual design system — basic Tailwind layout is enough

## Acceptance criteria (yes/no browser checks)

A stranger with only a browser can answer yes or no to each:

1. Visiting `/` shows the home shell with a visible title and navigation into
   Players and Games — **not** a blank white page.
2. Visiting `/players` shows a list region containing seed player names **in the
   initial HTML** (view source, or disable JavaScript, and the names are still there).
3. Visiting `/players/12` (a known seed id) shows that player's detail shell;
   the URL can be copied, pasted into a new tab, and reopened to the same page.
4. Visiting `/games` shows a list region containing seed games, each with an opponent.
5. The primary nav reaches Home, Players, and Games from every page with no
   broken links.
6. Visiting `/players/abc` or `/players/9999` shows a safe "player not found"
   state inside the normal layout — no raw error/crash screen.
7. This file names **server-rendered first paint** and **bookmarkable player
   URLs** as non-negotiable goals, so later agent prompts cannot quietly drop them.

## Locked decisions (do not reinterpret)

- Seed data includes **at least 12 players and at least 6 games**.
- Player ids are **positive integers**; the example bookmarkable id used in
  acceptance checks is **`/players/12`**.
- Unknown player id → **HTTP 200 + empty state**, never a 404 or a thrown error.
- Every game row shows an **opponent**; games do not need a player id.
- No "About" page — the four routes above are the whole route map.

## Sprint boundary

**Done for Sprint 1** means: a scaffolded TanStack Start app; a route tree
matching the map above; validated `playerId` path param; server-rendered page
shells that already contain seed directory content; short verification notes;
and a stakeholder handoff for the next sprint.

**Not done in Sprint 1**: production data pipeline, authentication, live feeds,
or any edit workflow.
