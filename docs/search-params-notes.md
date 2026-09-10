# Search params notes — directory filters

Source of truth: [`docs/requirements-brief.md`](requirements-brief.md) ·
[`docs/params-design-notes.md`](params-design-notes.md) (path params) ·
[`docs/route-map.md`](route-map.md)

Shared rules live in `src/lib/searchSchemas.ts` and are imported by both list
routes, so `/players` and `/games` never drift apart. Search params **filter a
list**; they never identify a single resource (that is the `$playerId` path
param).

## Players — `/players`

| Key | Allowed values | Default | Purpose |
|-----|----------------|---------|---------|
| `position` | `F`, `D`, `G`, `all` | `all` | Roster position filter |
| `status` | `active`, `ir`, `all` | `active` | Roster status filter |

- Declared with `validateSearch: validatePlayersSearch` on the route.
- The page reads typed values with `Route.useSearch()` — no `window.location`
  parsing.
- `search: { middlewares: [stripSearchParams(defaultPlayersSearch())] }` keeps
  bookmark URLs clean: a value equal to the default is removed from the query
  string.
- **Example bookmark:** `/players?position=F` (forwards, default active status).

## Games — `/games`

| Key | Allowed values | Default | Purpose |
|-----|----------------|---------|---------|
| `team` | any string, trimmed + upper-cased (e.g. `TOR`) | `''` (any) | Opponent code filter |
| `date` | `YYYY-MM-DD` | `''` (any) | Single-day filter |

- Declared with `validateSearch: validateGamesSearch`.
- `team` is normalised to upper-case, so `?team=tor` canonicalises to
  `?team=TOR`.
- `date` must match `^\d{4}-\d{2}-\d{2}$`; anything else is dropped.
- **Example bookmark:** `/games?team=TOR&date=2026-03-20`.

## Bad-input behaviour (verified in the browser)

The validators **never throw** — an unrecognised value resolves to the default.
Combined with `stripSearchParams`, a broken link is canonicalised with a `307`
redirect and always renders (HTTP 200), never a red error screen:

| Pasted URL | Result |
|------------|--------|
| `/players?position=NOTREAL&status=nope` | → `307` → `/players` (both fell back to defaults, then stripped) |
| `/players?position=F` | stays `/players?position=F` (valid) |
| `/games?date=yesterday` | → `307` → `/games` (invalid date dropped) |
| `/games?team=tor&date=2026-03-20` | → `307` → `/games?team=TOR&date=2026-03-20` (team upper-cased) |
| unknown keys, e.g. `/players?foo=bar` | ignored, dropped from the URL |

## Bookmark / refresh check

Filter links are router `<Link>`s with a `search` object (not `<a href>` and not
`useState`), so the address bar updates and a refresh keeps the same filter
state visible on the page.

## Deferred to later steps

- Real seed/server data behind these filters (the lists are placeholders now).
- Multi-select filters, date ranges, sort order.
- A polished filter UI (dropdowns) — plain links are enough to prove the URL
  contract.
