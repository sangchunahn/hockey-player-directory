# Type generation notes — scouting schema

**Date:** 2026-10-03
**Output:** `src/types/database.ts` (generated, checked in — the typed contract later query modules import)

---

## Migration applied

| | |
|---|---|
| File | `supabase/migrations/001_scouting_schema.sql` |
| Applied via | Supabase Dashboard → **SQL Editor** → New query → paste file → **Run** → "Success. No rows returned." |
| Project | `hockey-player-directory`, ref `bsjodruzecdaymnxjade` (us-east-1, Postgres 17) |
| Confirmed by | Table Editor lists `players`, `games`, `scouting_events` |

The project ref is not a secret — it is the subdomain of the public project URL.
No API keys, service-role key, or database password are used by typegen or
recorded here.

---

## Regenerate types (repeatable recipe)

One-time per machine:

```bash
npx supabase login
```

Every time:

```bash
npm run gen:types
```

`npm run gen:types` runs `scripts/gen-types.mjs`, which wraps:

```bash
npx --yes supabase@2.119.0 gen types typescript --project-id bsjodruzecdaymnxjade --schema public
```

It writes the result to **`src/types/database.ts`** with a "GENERATED — do not edit"
header. The CLI version is pinned so two people regenerating get the same output
format.

**Guard:** the script refuses to overwrite the file if `players`, `games`, or
`scouting_events` is missing from the output. This exists because the **first
typegen run happened before the migration was applied** and silently produced an
empty `Database` type (`Tables: { [_ in never]: never }`) with exit code 0. Without
the guard, that empty file could have been committed and every later query would
have typed against nothing. When you add a table, add it to `EXPECTED_TABLES` in the
script.

---

## What was verified after generating

- [x] `Database['public']['Tables']` has `players`, `games`, `scouting_events`, each
      with `Row` / `Insert` / `Update` shapes.
- [x] **All 20 columns match the migration exactly** (snake_case, compared
      mechanically): players 7, games 5, scouting_events 8.
- [x] Nullability matches. `sweater_number`, `period`, and `note` are `| null`;
      `id`, `created_at`, and `updated_at` are optional on `Insert` because they
      have defaults.
- [x] `scouting_events.Relationships` lists `scouting_events_player_id_fkey` →
      `players.id` and `scouting_events_game_id_fkey` → `games.id`.
- [x] Enums are exact unions: `player_position` = `"F" | "D" | "G"`;
      `scouting_event_type` = `"goal" | "assist" | "shot" | "hit" | "penalty" | "note"`.
- [x] `npx tsc --noEmit` passes with the file in place.
- [x] **Compile-time safety proven.** A throwaway probe was compiled and then
      deleted: reading `players.Row['full_name']` (a column that doesn't exist) and
      assigning position `'C'` were both **rejected by `tsc`**.

Expected omission: `public.set_updated_at()` does not appear under `Functions`,
because type generation skips trigger functions. The aggregate RPC added in a later
step *will* appear there.

---

## When to regenerate

After **any** schema or RPC change: apply the new migration to the project first,
then run `npm run gen:types` and commit the updated `src/types/database.ts` in the
**same commit** as the migration. Never hand-edit the generated column lists to
"fix" drift. Change the SQL, apply it, regenerate.

---

## Caveats

- **No CLI migration history yet.** `001` was applied through the dashboard, so the
  project's `supabase_migrations` history table does not record it. If the team
  switches to `supabase db push` later, first run
  `npx supabase link --project-ref bsjodruzecdaymnxjade`, then
  `npx supabase migration repair --status applied 001`. Otherwise `db push` will
  try to re-create tables that already exist and fail.
- `supabase/.temp/` (CLI cache, created by `gen types`) is gitignored.
- Typegen needs `npx supabase login` on the machine running it. It does **not**
  read `.env.local`, so it works even before the app's runtime env is filled in.
