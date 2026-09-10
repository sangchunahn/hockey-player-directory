# Path params design notes — player detail

Source of truth: [`docs/route-map.md`](route-map.md) · [`docs/requirements-brief.md`](requirements-brief.md)

## Decision

| Item | Value |
|------|-------|
| Route file | `src/routes/players/$playerId.tsx` |
| URL pattern | `/players/$playerId` |
| Param name | `playerId` (matches the route map and the helper — **not** `id` or `player`) |
| Shared helper | `src/lib/playerParams.ts` |

The `$` prefix in the filename is what tells TanStack Router that this path
segment is a **value**, not a fixed word. One route file serves every
`/players/<id>` URL.

## Validation (Sprint 1)

- `parsePlayerIdParam(value)` in `src/lib/playerParams.ts`:
  - must be a `string`
  - trimmed length must be greater than 0
  - returns the trimmed string, or `null` if it cannot be a valid id
- The route's `params.parse` calls the helper and returns `false` when the id is
  invalid. Returning `false` means **this route does not match**, so the router
  sends the visitor back to `/players` (a `307` redirect to the roster list)
  instead of rendering a fake "success" player sheet with an empty id.
- Deliberately minimal for now. Real roster ids (jersey numbers, UUIDs) can
  tighten `parsePlayerIdParam` later without touching the route file or any
  `<Link>`.

Reachable test: `GET /players/%20` (a whitespace-only id) trims to empty →
`params.parse` returns `false` → `307` redirect to `/players`. `/players/`
(empty segment) is served by the players **index** route, not the detail route.
A normal non-empty string such as `/players/abc` is valid for this sprint and
renders the detail shell.

## Linking

- The players index (`src/routes/players/index.tsx`) links each row with the
  router's type-safe helper:

  ```tsx
  <Link to="/players/$playerId" params={{ playerId: player.id }}>
    {player.name}
  </Link>
  ```

- The detail page reads the value with `Route.useParams()` and shows it in the
  UI so a human can confirm the URL and the page agree.
- `playerDetailPath(id)` in the helper builds the same URL as a plain string
  when a non-`<Link>` context needs it (URL-encoded).
- **Do not** rely on `?playerId=` query strings for the detail page — the
  client story needs a real, bookmarkable path segment.

## Why this matters for hockey ops

A scout on arena wifi must paste a player's URL into chat and have a teammate
open the **same** sheet later. Putting `playerId` in the path (not React state,
not a fragile query string) makes each player page bookmarkable and
shareable, and it survives a refresh. Keeping the parse rule in one shared
helper keeps the list links, the detail route, and future server loaders
consistent.

## Deferred to later steps

- Server-rendered player data (name, team, stats) in the first HTML.
- Search-param validation for filters/views on `/players` and `/games`.
- A polished not-found design for unknown ids.
