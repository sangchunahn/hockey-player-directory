# Hockey Ops Player Directory — Route Map

Source of truth: [`docs/requirements-brief.md`](requirements-brief.md)
Scaffold context: [`docs/scaffold-notes.md`](scaffold-notes.md)
Framework: TanStack Start + TanStack Router (file-based routes under `src/routes/`)

## Why this map exists

Hockey ops staff on arena wifi must open **bookmarkable URLs** and see a
**consistent shell** on every screen. This document locks the path names and
their file homes before any page UI is built, so later steps have a fixed
contract to implement against.

## Route table

| URL path | Kind | Purpose (hockey ops) | Route file (planned) | Bookmarkable? |
|----------|------|----------------------|----------------------|---------------|
| `/` | static | Home / directory landing: title, intro, links into Players and Games | `src/routes/index.tsx` | yes |
| `/players` | static | Full players list (seed data) staff scan for the roster | `src/routes/players/index.tsx` | yes |
| `/players/$playerId` | **dynamic** | One player's detail page — each id is its own shareable URL | `src/routes/players/$playerId.tsx` | yes (every id is a distinct URL) |
| `/games` | static | Games index (seed data), each row showing the opponent | `src/routes/games/index.tsx` | yes |

No routes exist outside these four for Sprint 1.

## Path segments (plain language)

- **Static segment** — a fixed word in the URL that is the same for everyone:
  `players`, `games`.
- **Dynamic segment** — a placeholder that changes per resource. In TanStack
  file-based routing the filename `$playerId.tsx` means "this part of the URL is
  a *value*, not a fixed word." The value is read as `params.playerId`.
  Example: visiting `/players/12` gives `playerId === "12"`.
- **Index route** — the default page for a folder path: `/players` is served by
  `src/routes/players/index.tsx`.

### Why `$playerId` and not a query string or click-state

Staff need to paste a player's URL into chat and have a teammate land on the
**same player**. A path param (`/players/12`) puts the player id in the address
bar, so it can be bookmarked, shared, and reopened. A query string
(`/players?id=12`) would also work but the brief's convention is a path param;
in-page click state (never changing the URL) would fail the "bookmarkable"
acceptance check entirely.

## Root layout

- File: `src/routes/__root.tsx`
- Role: the shared shell for all pages. Two parts:
  - `shellComponent` (`RootDocument`) — the HTML document (`<html>`, `<head>`
    with `HeadContent`, `<body>` with `Scripts`).
  - `component` (`RootLayout`) — the visible chrome: a **"Hockey Ops Directory"**
    header, a placeholder for primary navigation, and `<Outlet />` where child
    routes render.
- Out of scope for the root: player/games tables, filters, data fetching. Those
  live in the individual route files.

## Generated route tree

- File: `src/routeTree.gen.ts`
- Role: framework-generated wiring from the files in `src/routes/` into the
  router. Currently it wires `__root__` and `/` only — the players and games
  route files are added in later steps and the tree regenerates then.
- Regenerate with `npm run generate-routes` (or automatically via `npm run dev`).
  **Do not hand-edit this file** — the generator overwrites it.

## Layout + child relationship (target for the sprint)

```text
__root (shell: "Hockey Ops Directory" header + <Outlet />)
├── index                    -> /
├── players/index            -> /players
├── players/$playerId        -> /players/:playerId   (bookmarkable)
└── games/index              -> /games
```

## Acceptance hooks from the brief

- [ ] Every player has a shareable URL shaped like `/players/<id>` (e.g.
      `/players/12`) — the address bar changes, not just in-page state.
- [ ] Home, players list, and games each have their own path staff can type or
      bookmark.
- [ ] The root layout is the one place for shared chrome, so pages stay
      consistent.
- [ ] No mystery routes beyond the four in the table above.

## Deferred to later steps

- Page UI for home / players / games — **Step 5** (static routes).
- The `/players/$playerId` route file and `playerId` validation — **Step 7**.
- Search-param validation (filters/views) — later params step.
- Server-rendered seed data in the first HTML — SSR step.
