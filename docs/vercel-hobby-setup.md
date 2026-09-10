# Vercel Hobby setup — hockey ops directory

**Date:** 2026-09-10
**Vercel plan:** Hobby (free) — not Pro
**Vercel project:** `hockey-player-directory` (team: sangchunahn's projects, Hobby)
**Application preset:** Nitro (auto-detected — powers TanStack Start SSR on Vercel)

## URLs (the same ones reused all semester)

| Item | Value |
| --- | --- |
| GitHub repository (pushable) | https://github.com/sangchunahn/hockey-player-directory |
| Instructor collaborator `thortek` added | **yes** (added in the version-control step) |
| **Vercel Production URL** | **https://hockey-player-directory-wine.vercel.app** |
| Preview / deployment URLs (do **not** submit) | `…-git-main-sangchunahns-projects.vercel.app` (branch alias), `…-45006xrrq-sangchunahns-projects.vercel.app` (per-deploy hash) |

The Production URL is the one submitted to Canvas — never a `-git-` alias or a
per-deployment hash URL.

## Hobby constraints being kept

- **One** Vercel project for this course — later sprints redeploy this same
  project, never "Add New Project".
- Production deploys from `main` only.
- No cron jobs / Fluid Compute config / paid add-ons.
- Secrets (Supabase keys etc., arriving in Sprint 2) go in the Vercel dashboard
  Environment Variables — never in git or in this file.

## How the build works

- `vite.config.ts` includes `nitro()` from `nitro/vite` (commit `43445f1`), so
  the build emits a server bundle Vercel runs as a Vercel Function. SSR and the
  route loaders keep working in production — this is **not** a static `dist`
  export.
- No `vercel.json` — Vercel auto-detects TanStack Start + Nitro.
- Build command / output: Vercel defaults (`npm run build` → `.output/`).

## First production deploy

- **Status: Ready** — first deploy from `main` succeeded, no build fixes needed.
- Incognito check of the Production URL: **pass** — the hockey ops directory app
  loads (home page with player/game counts and featured players), not the Vercel
  dashboard.
- Route spot-check against the Production URL (server-rendered HTML, HTTP 200):

  | URL | Result |
  | --- | --- |
  | `/` | "Hockey Ops Player Directory" + featured players in first HTML |
  | `/players` | full seed roster server-rendered |
  | `/players/12` | Alex Mercer detail server-rendered |
  | `/players/9999` | "Player not found" at HTTP 200 |
  | `/games?team=TOR` | filtered to Toronto games |

## Redeploy / keep-alive for later sprints

Every push to `main` triggers a new Production deploy automatically. To keep the
URL working: keep pushing to `main` in this same repo/project, and never delete
the Vercel project.
