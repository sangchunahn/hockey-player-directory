# Sprint 2 handoff — server functions, secret hygiene, first Vitest suite

**Date:** 2026-09-19
**Branch:** `main`
**Audience:** whoever picks up the next Sprint 2 topic, and anyone reviewing the boundary
**Scope note:** this topic added no new product feature. It moved directory reads behind a
server boundary, split public from secret configuration, and put a first automated safety
net under the pure logic.

---

## 1. Summary — what shipped

- Directory reads run through a **TanStack Start server function**, `getDirectoryEntries`
  in `app/server/directory.ts`. The browser calls it and receives finished rows; the
  Supabase service-role key never enters the client bundle.
- **Public and secret environment variables are separated.** `.env.example` is the
  committed contract (names and comments only); `app/config/env.ts` exposes `publicEnv`
  and `serverEnv` as two separate objects so client code cannot reach a secret through a
  shared surface.
- **One server-only Supabase client**, `app/lib/supabase.server.ts`, built from
  `serverEnv`. It is imported by exactly one module.
- **Pure mappers** live in `app/lib/directory/mappers.ts` with no Supabase, env, network
  or clock, and are covered by 12 Vitest cases in `app/lib/directory/mappers.test.ts`.
- **The UI is wired**: `app/routes/directory.tsx` holds the page (loader, component,
  empty state, error state) and calls the server function.

---

## 2. Boundary decisions (keep these stable)

| Concern | Decision | Where it lives |
| --- | --- | --- |
| Who talks to Supabase with privileged credentials | Server only, one module | `app/lib/supabase.server.ts`, called from `app/server/directory.ts` |
| What the browser may know | `VITE_`-prefixed public values only; never the service role | `.env.example`, `app/config/env.ts` |
| How secrets are read | Lazy getters on `serverEnv`; throws by name if missing, and refuses to run in a browser | `app/config/env.ts` |
| What crosses to the browser | Exactly six `DirectoryEntry` fields, built field by field — never a row spread | `app/lib/directory/mappers.ts` |
| What a failure looks like | Flat `ok:false` with `VALIDATION` / `UPSTREAM` / `UNKNOWN`; raw Supabase errors logged server-side only | `app/server/directory.ts` |
| What is unit-tested in isolation | Pure validation, escaping and row mapping | `app/lib/directory/mappers.test.ts` |
| The agreed input/output contract | Written before any code | `docs/server-function-contract.md` |

### Two decisions that revise earlier notes

1. **Sprint 1 decision D7 is amended.** `docs/decisions-log.md` D7 said a later sprint
   would "swap the helper bodies for Supabase with no route changes." Following that
   literally would have leaked: `src/server/directoryLoader.ts` is imported directly by
   three route files, and a TanStack Start `loader` runs in the browser on client-side
   navigation — so a service key in that module's body would ship. The route now calls a
   server function instead. D7's *intent* (route components should not care where data
   comes from) survives; its "no route changes" clause does not.
2. **`isActive` was dropped from `DirectoryEntry`.** The `directory_people` table has no
   status column, so the field would have been fabricated. See open risks below.

---

## 3. Secret-hygiene proof

Every line below was run on 2026-09-19 against the current `main`. Variable **names**
only — no values appear in this document, and none were pasted into any chat.

- [x] **`.env.example` lists names with empty values.** All four — `VITE_SUPABASE_URL`,
      `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — checked as
      empty. No real key, password or token in the file.
- [x] **No secret carries a client prefix.** Grep of `.env.example` and
      `app/config/env.ts` for `VITE_.*(SERVICE|SECRET|ROLE)` → no matches.
- [x] **The secret client has exactly one importer.** Grep for
      `from '…supabase.server'` across `app/` and `src/` → one hit,
      `app/server/directory.ts:18`.
- [x] **The browser route touches no secrets.** Grep of `app/routes/directory.tsx` and
      `src/routes/directory.tsx` for `supabase`, `serverEnv`, `SERVICE_ROLE`,
      `process.env` → the only matches are comments stating the rule.
- [x] **Real env files stay out of git.** `git check-ignore` exits 0 for `.env.local` and
      `.env`, and exits 1 for `.env.example` (tracked, as intended). Across all history,
      `.env.example` is the only `.env*` path ever committed.
- [x] **Nothing secret in the built client bundle.** After `npm run build`, 7 client
      assets scanned for `SERVICE_ROLE`, `service_role`, `createClient`,
      `directory_people`, `supabase` → zero matches.
- [x] **Nothing secret in what the browser loads.** With the production server running
      (`node .output/server/index.mjs`), `/directory` was opened and the SSR HTML plus
      every loaded script were fetched and searched for `SERVICE_ROLE`, `service_role`,
      `eyJ` (JWT prefix), `supabase.co`, `directory_people`, `SUPABASE_URL` → zero
      matches.
- [x] **The client-side path was exercised too.** Navigating in-app to Directory issues a
      real `GET /_serverFn/…` request (HTTP 200). Its response body carried no secret
      material.

**One caveat, stated plainly:** these scans prove the *absence of secrets* in what the
browser receives. They are not production monitoring, and they were run with no real
credentials configured locally (see §5).

---

## 4. Test status

| | |
| --- | --- |
| Config | `vitest.config.ts` (standalone; environment `node`; imports no app modules) |
| Suite | `app/lib/directory/mappers.test.ts` |
| Result | **PASS — 12/12**, `npm test` exit 0 |
| Typecheck / build | `tsc --noEmit` exit 0; `npm run build` exit 0 |

**Behaviors protected:** an unrecognized `role` filter is rejected rather than silently
ignored; `limit` is clamped to 1–200 so nobody can request the whole table; a searched
`%` matches a literal percent instead of every person; a staff member keeps
`jerseyNumber: null` so the UI never renders `#0` beside a coach; a row with an
unrecognized role is dropped rather than guessed at; and a mapped entry carries only the
six permitted fields.

**The suite was proven to fail.** Replacing the field-by-field build in
`mapRowToDirectoryEntry` with a spread of the raw row turned two tests red, naming the
leaked columns (`full_name`, `jersey_no`, `team`, `position`). Reverting returned all 12
to green. `passWithNoTests` was removed once real tests existed, so a run that discovers
no tests now fails instead of reporting success.

---

## 5. Leftover risks and known gaps

**Ordered by what would bite soonest.**

1. **The directory has never returned a real row.** This is the largest gap. `.env.local`
   does not exist and `public.directory_people` has not been created or seeded, so
   `/directory` currently renders the `UNKNOWN` error state. That is *correct* behavior —
   the env read throws, the handler catches it, and the UI shows one friendly sentence
   with no stack trace — but it means the happy path is proven only in unit tests and by
   code inspection, **not against live data**. First task for the next person: fill
   `.env.local` from `.env.example`, create and seed the table, reload `/directory`, and
   confirm rows appear.
2. **`npm run dev` does not currently start in this environment.** The Vite 8.2.2 +
   Nitro-beta SSR worker wedges with `transport invoke timed out … (getBuiltins)`. This
   reproduces on a clean checkout with none of this topic's files, so it is environmental
   rather than caused by our code. All verification here was done against the production
   build (`npm run build` then `node .output/server/index.mjs`), which works. Worth a
   timebox before the next topic, since the dev loop matters more than any single feature.
3. **No auth, on a public URL.** There is still no login, and production is live at the
   Vercel URL in `docs/vercel-hobby-setup.md`. Anyone who finds it sees the whole
   directory. This is the reason for the next-topic recommendation below.
4. **The IR / injury-visibility question is deferred, not answered.**
   `docs/client-vs-server-inventory.md` §3 flagged that publishing who is injured is
   health-adjacent information about a named person. `directory_people` happens to have
   no status column, so the question is dormant — it returns the moment anyone adds one.
5. **Two route files for one page.** `app/routes/directory.tsx` holds the page, but
   TanStack Router's generator only scans `src/routes` and needs to see the
   `createFileRoute` call itself (a re-export is rejected with "does not export a Route").
   So `src/routes/directory.tsx` exists as four lines of registration. Anyone adding
   another `app/routes/*` page needs the same pair.
6. **Sprint 1's position filter is not wired to real data.** `/players` filters by
   `'F' | 'D' | 'G'`; `directory_people.position` is free text (`'Center'`,
   `'Head Coach'`). Out of scope for this topic, still unresolved.
7. **Games and the rest of the app still read seed data.** `src/data/hockeySeed.ts` and
   `src/server/directoryLoader.ts` are untouched; only `/directory` is Supabase-backed.

**Not claimed:** no Playwright or end-to-end coverage, no CI, no auth, no RLS, no RPC, no
mutations. None of that was built in this topic.

---

## 6. What rolls into the next Sprint 2 topic

**Recommendation: auth-aware loads.**

**Why.** The boundary built here keeps the *credential* off the browser, but it does not
yet decide *who may see which rows* — and right now the answer is "everyone, including
anyone who finds the public URL." That is the one gap where the current design is
genuinely incomplete rather than merely unfinished: the server function already has the
right shape to enforce visibility (it validates its own inputs and never trusts the
caller), so adding a session check is an extension, not a rewrite. It also unblocks the
IR-visibility question in §5.4, which cannot be answered while every visitor is anonymous.
`UNAUTHORIZED` is already named in the contract and deliberately unimplemented, so the
success shape will not change when it lands.

RPC and richer workflows are both reasonable follow-ons, but each assumes a notion of
"who is asking" that does not exist yet.

**Before starting it,** clear items §5.1 and §5.2 — real data flowing and a working dev
server — or the next topic inherits two unknowns.

---

## 7. File map for the next reader

| Path | Role |
| --- | --- |
| `docs/boundary-risk-notes.md` | Why browser-held secrets fail the client story |
| `docs/client-vs-server-inventory.md` | What may run where, and why |
| `docs/server-function-contract.md` | Agreed inputs, outputs, error codes, pure/IO split |
| `docs/decisions-log.md` | Sprint 1 decisions — see the D7 amendment in §2 |
| `docs/vercel-hobby-setup.md` | Production URL; where production secrets live |
| `.env.example` | Public vs secret variable names (committed; values empty) |
| `app/config/env.ts` | `publicEnv` / `serverEnv` — the only place env is read |
| `app/lib/supabase.server.ts` | Server-only Supabase client |
| `app/server/directory.ts` | `getDirectoryEntries` server function (the I/O half) |
| `app/lib/directory/mappers.ts` | Pure validation, escaping, row mapping |
| `app/lib/directory/mappers.test.ts` | First Vitest suite — 12 cases |
| `app/routes/directory.tsx` | The directory page; calls the server function |
| `src/routes/directory.tsx` | Route registration only — see §5.5 |
| `vitest.config.ts` | Test config; deliberately loads no app plugins or env |

---

## 8. Stakeholder one-liner

The Hockey Operations Directory now loads through a server-side path with credentials
separated from anything the browser can see, backed by a first automated test suite that
has been proven to catch a real mistake; the page is wired end to end but still needs the
database connected to show live rows, and the next slice should decide who is allowed to
see what.
