# Boundary risk notes — Hockey Operations Directory (Sprint 2, Topic 1)

> Planning doc. No implementation code here — later steps build against this checklist.
> Jargon is glossed on first use so a teammate new to the stack can skim it in two minutes.

**Glossary (read once):**
- **Browser bundle** — the JavaScript files Vite ships to the fan's laptop or phone. Anything in there can be read by opening DevTools. Nothing in the bundle is secret.
- **Server function** — a TanStack Start function that only ever executes on the server. The browser calls it over the network and gets back data, never the code or the credentials inside it.
- **Anon key** — Supabase's public, row-level-security-gated key. Designed to be seen.
- **Service role key** — Supabase's admin key. Bypasses row-level security. Master key. Server only, always.
- **Mapper** — a plain function that turns a raw database row into the shape the UI renders. No network, no database, no secrets — which is exactly why it is easy to unit-test.

---

## Client story (one paragraph)

The Hockey Operations Directory must stop rendering the in-memory seed arrays in `src/data/hockeySeed.ts` and start loading **real player and staff rows from Supabase**. Those privileged reads need Supabase credentials, and the credential that makes them work — the service role key — bypasses every row-level security rule in the database. If it reaches the browser bundle, anyone who opens DevTools on a public page owns our database. So this sprint moves directory data loading behind **TanStack Start server functions**, splits environment variables into **public (safe to expose) vs secret (server only)**, and pulls the row-shaping logic into **pure mappers** covered by a first **Vitest** suite. The browser keeps doing what it already does well: render the directory UI and call a server function for data.

---

## What might naively run in the client (risks)

Each bullet is a mistake that is easy to make *in this repo specifically*.

1. **Service role key behind a `VITE_` prefix.** Vite only exposes env vars that start with `VITE_` to the browser. Someone hits "supabaseKey is undefined" locally, renames `SUPABASE_SERVICE_ROLE_KEY` to `VITE_SUPABASE_SERVICE_ROLE_KEY` to make the error go away, and silently ships an admin key in `dist/assets/*.js`. This is the single highest-severity mistake available to us.
2. **Supabase client constructed inside a React component or route module.** `createClient(url, serviceRoleKey)` written at the top of `src/routes/players/index.tsx` puts both the call and the key into the client graph. Vite bundles what route files import.
3. **`src/server/directoryLoader.ts` swapped in place without a boundary.** Today this module is imported *directly* by `src/routes/players/index.tsx`, `src/routes/players/$playerId.tsx`, and `src/routes/games/index.tsx`, and a TanStack Start route `loader` runs on the server for the first paint **and in the browser on client-side navigation**. Today that is harmless — it reads a seed array. The moment its body reads `process.env.SUPABASE_SERVICE_ROLE_KEY`, that key is being pulled into a module the browser already imports. The file name says "server"; the import graph does not agree. This is the specific trap this sprint exists to close.
4. **`useEffect` fetching straight to Supabase from a component**, with a key embedded in the front-end bundle to authenticate the call.
5. **Logging secrets by accident.** `console.log(import.meta.env)`, `console.log(process.env)`, or dumping a raw Supabase error object (which can echo request headers) into a browser console or an error-boundary UI.
6. **Committing a real `.env`.** `.gitignore` already covers `.env` and `.env.*` with a `!.env.example` exception — but pasting a real key into `.env.example`, into this doc, or into a code comment defeats it.
7. **Secrets crossing the wire in the response.** A server function that returns the whole raw Supabase row (or a debug field carrying the connection config) leaks through the JSON payload even when the key itself never gets bundled. Check the Network tab, not just the JS files.

---

## What must move server-side

- **Every use of the Supabase service role key**, or any credential that is not explicitly public.
- **A server-only Supabase client module** — e.g. `src/server/supabase.server.ts` — that reads secret env vars and is imported *only* by server functions, never by a route component or anything under `src/components/`.
- **Directory read orchestration**: querying player and staff rows, applying the position/status filters that `listPlayers` handles today, and turning Supabase errors into a safe, non-leaky message for the UI.
- **The environment loader** that reads secret vars and fails loudly at startup if one is missing — so we find out on the server, not by shipping `undefined` to a browser.
- **The existing loader surface** in `src/server/directoryLoader.ts`: the route-facing functions stay, but the data access behind them becomes a server function so the browser stops importing the module that touches credentials.

---

## What may stay in the client

- All presentational directory UI: the player and game tables, filter controls, loading/empty/not-found states, `AppNav`, `NotFoundPlayer`.
- The existing URL search-param work in `src/lib/searchSchemas.ts` and `src/lib/playerParams.ts` — validating and stripping query params involves no credentials.
- **Calling a server function and rendering what it returns.** The browser receives an already-shaped DTO (data transfer object — the trimmed row shape the UI needs) and never sees a raw credential.
- **Genuinely public config**, clearly named — the Supabase project URL and anon key, *if* we decide to use them for any non-privileged read. These may carry a `VITE_` prefix; secret vars never may.

---

## Success criteria for this tutorial (checklist)

Each item is a yes/no check against a file, a test run, or an inspection.

- [ ] **Env split documented.** `.env.example` exists and is committed, listing public vars with a `VITE_` prefix and secret vars (e.g. `SUPABASE_SERVICE_ROLE_KEY`) with **no** client prefix. Values are placeholders only.
- [ ] **No secret is client-prefixed.** `grep -r "VITE_.*SERVICE_ROLE" src .env.example` returns nothing.
- [ ] **Server-only Supabase module exists** (e.g. `src/server/supabase.server.ts`) and is imported by server functions only — grep its import sites and confirm none live in `src/routes/**` component code or `src/components/**`.
- [ ] **A TanStack Start server function loads directory data**, and the route files call that function instead of importing a credential-touching module.
- [ ] **Pure mappers are extracted** into their own module (e.g. `src/lib/directoryMappers.ts`) with no imports of Supabase, env, or `fetch` — row in, UI shape out.
- [ ] **Vitest is configured and runs**: `npm test` executes. At least one mapper test exists that genuinely discriminates — it fails when the mapper is wrong (verify by temporarily breaking the mapper) and passes when it is right.
- [ ] **Nothing secret in the built bundle.** After `npm run build`, grep `.output/` and `dist/` for `SERVICE_ROLE` and for the literal secret value — zero hits.
- [ ] **Nothing secret on the wire.** Load `/players` with the Network tab open; no request or response payload contains a key.
- [ ] **Handoff note written** recording the boundary decisions (chosen env var names, server-function contract) for the next topic.

---

## Out of scope for this topic (do not solve here)

- Auth UX, login flows, or role-based permissions beyond what the server boundary requires.
- Playwright / end-to-end tests, CI wiring, production hardening, rate limiting.
- Writing exploits or demonstrating real key theft — this is defensive separation only.
- Any implementation code. This file is a checklist; the code lands in later steps.

---

## Open questions to resolve in later steps

- Exact input/output contract for the directory server function: does it take the already-validated `PlayersFilter` shape that `listPlayers` uses today, or a narrower one?
- Which env var names we standardize on: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` server-side, and whether we need `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` client-side at all this sprint.
- Do staff rows live in a separate Supabase table from players, and does that change the mapper boundary?
- What does the UI show when Supabase is unreachable — cached seed data, or an explicit error state?
