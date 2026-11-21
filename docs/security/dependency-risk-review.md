# Dependency and supply-chain risk review

Status: draft for the confidential-roster hostile review
Author: Sang Chun Ahn
Date: 2026-11-20

## What this note is

This note lists the libraries this hockey roster tool asks other people to
write for us. It tells stakeholders which supply-chain risks we accept for the
hostile review, and which we do not. It does not upgrade anything.

## Files read

- `package.json` (direct dependencies and devDependencies only)
- `docs/security/attack-surface-map.md`

## Changes we did not make

- Packages upgraded: no
- Lockfile changed: no
- `npm audit fix` or `npm update` run: no

## Direct dependencies

Copy names only from `dependencies` and `devDependencies` in `package.json`.
Do not invent packages. Do not paste the lockfile. Do not paste secrets.

| Package name | dependencies or devDependencies | What it is for in this roster tool | Affects auth | Affects HTML | Affects server requests | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `@supabase/ssr` | dependencies | Reads and writes the staff sign-in session from server-side cookies so `requireSession()` can trust it | yes | no | yes | Directly backs the session check named in `docs/security/attack-surface-map.md`'s login row |
| `@supabase/supabase-js` | dependencies | The Supabase client: `signInWithPassword` on the login page and every scouting read/write query | yes | no | yes | Same trust boundary as the login and scouting-write rows in the attack-surface map |
| `@tailwindcss/vite` | dependencies | Build-time CSS plugin for the app's styling | no | no | no | Produces stylesheets, not markup or requests; nothing here touches note text or sessions |
| `@tanstack/react-devtools` | dependencies | Developer-facing devtools overlay panel | no | no | no | Not part of what a signed-in staff member or the public sees on the roster pages |
| `@tanstack/react-query` | dependencies | Caches and refetches scouting data for the hooks in `src/lib/scouting/hooks.ts` | no | no | yes | Triggers the same reads/writes already named for the scouting pages in the attack-surface map |
| `@tanstack/react-router` | dependencies | Matches URLs like `/players/{id}` to route files and reads path params | no | no | no | Hands the raw `playerId` path parameter to the route's loader; it does not itself query or render data |
| `@tanstack/react-router-devtools` | dependencies | Developer-facing router devtools overlay | no | no | no | Not shown to staff on the production roster pages |
| `@tanstack/react-start` | dependencies | The framework running the server functions and API routes (`src/routes/api/events.ts`, `src/routes/api/evaluations.ts`, `listScoutingNotes`) | no | yes | yes | Carries every request named in the attack-surface map's events ingestion, evaluations ingestion, and scouting rows |
| `nitro` | dependencies | The server runtime that actually receives and answers HTTP requests underneath `@tanstack/react-start` | no | no | yes | Everything that reaches `src/routes/api/*` passes through this first |
| `react` | dependencies | Renders every page, including the scout-written note text on `src/routes/scouting/index.tsx` and `src/routes/scouting/events.tsx` | no | yes | no | Its default text-escaping is the reason the XSS row in `docs/security/attack-surface-map.md` says the hole is only real if that escaping is bypassed |
| `react-dom` | dependencies | Puts React's rendered output into the actual browser page | no | yes | no | Same escaping boundary as `react`, on the client side |
| `tailwindcss` | dependencies | Utility CSS classes used across the app's pages | no | no | no | Styling only; does not touch note text, sessions, or requests |
| `@tanstack/devtools-vite` | devDependencies | Build-time plugin that wires the devtools panel into local development | no | no | no | Dev-only; not present in what staff load on the deployed site |
| `@tanstack/router-cli` | devDependencies | Generates route files from `src/routes/` during development (`tsr generate`) | no | no | no | A build-time code generator; it does not run while the app answers a request |
| `@types/node` | devDependencies | TypeScript type definitions for Node.js APIs | no | no | no | Type information only, compiled away; ships no runtime code |
| `@types/react` | devDependencies | TypeScript type definitions for React | no | no | no | Type information only, compiled away |
| `@types/react-dom` | devDependencies | TypeScript type definitions for `react-dom` | no | no | no | Type information only, compiled away |
| `@vitejs/plugin-react` | devDependencies | Lets Vite build React/JSX files | no | no | no | Build-time only; not part of the running server or served page |
| `typescript` | devDependencies | Compiles and type-checks the project's TypeScript | no | no | no | A compiler step, not something that runs when a staff member loads a page |
| `vite` | devDependencies | Local dev server and production build tool | no | no | no | Builds the app before it runs; it is not the server answering staff or provider requests |
| `vitest` | devDependencies | Runs the project's test files (for example `tests/ingestion/event-store.test.ts`) | no | no | no | Test-only; never loaded when a real staff member or the provider uses the app |

## Suggested audit findings (not applied)

`npm audit` was run (read-only, no fix or update). It reported 0 vulnerabilities
across 298 installed packages (170 prod, 63 dev, 86 optional, 0 peer) at the
time of this review.

| Package | Severity as reported | Plain-language meaning | Applied? |
| --- | --- | --- | --- |
| none reported | n/a | `npm audit` found no known vulnerable versions among the currently installed packages | suggestion only, not applied |

## Risks accepted for the hostile review

Write this so a coach or operations lead can read it without opening code.

- **Accepted:** `@tanstack/react-devtools` and `@tanstack/react-router-devtools` ship in `dependencies`, not `devDependencies`, even though they are developer-only overlay panels. Reason: `npm audit` shows no known vulnerability in either package today, and neither one touches sign-in, note text, or server requests, so leaving their placement alone does not change what a hostile reviewer can reach. We would stop accepting this once either package starts showing a reported vulnerability, or once we confirm the production build actually serves their code to a visitor.
- **Accepted:** Several packages (`@tanstack/react-router`, `@tanstack/react-devtools`, `latest`-pinned in `package.json`) are not locked to an exact version in `package.json` itself. Reason: `package-lock.json` still records the exact installed version, so today's install is reproducible, and this note's audit found nothing wrong with what is currently installed. We would stop accepting this once a `latest`-pinned package's installed version changes without anyone noticing, which an unpinned version string makes easier to miss.
- **Not accepted:** Any future change that lets `@supabase/ssr` or `@supabase/supabase-js` read or write session data without going through `requireSession()` on the server, since those two packages are the libraries the login and scouting rows in `docs/security/attack-surface-map.md` depend on to keep coaching and medical staff out of scouting notes.
- **Not accepted:** Any future change that renders scout-written note text through `react`/`react-dom` without that text passing through React's normal escaping (for example `dangerouslySetInnerHTML` or a rich-text renderer), since that is the exact XSS mechanism named against the scouting pages in the attack-surface map.

## How a reviewer can check this note

- Every package name in the table is a key in `package.json`.
- No package name was added that is not in `package.json`.
- `package.json` and the lockfile are unchanged after this note was written.
