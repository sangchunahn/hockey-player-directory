# Scaffold notes — hockey ops player directory

Date: 2026-09-09

## What we generated

A **TanStack Start** application (React + TypeScript + Vite + Tailwind CSS v4)
scaffolded with the official TanStack CLI into the existing project folder.

Command used (run from the project root, non-interactive):

```bash
npx @tanstack/cli@latest create hockey-player-directory \
  --framework react --non-interactive --package-manager npm \
  --no-git --no-toolchain --no-examples --target-dir . --force
```

- `--no-git` — the repo already existed from Step 1, so the CLI did not
  re-init it.
- `--no-examples` — no demo/example pages; we only want the starter shell so
  the scaffold PR stays small and reviewable.
- `--no-toolchain` — skipped the optional ESLint/Biome add-on for now.
- `--force` — the target folder was not empty (it held `docs/`, `.git/`,
  `README.md`, `.gitignore`).
- **No player data, Supabase, auth, or custom hockey routes were added.** Those
  are later steps.

Dependencies were installed by the CLI (`node_modules/` and
`package-lock.json` are present). One non-fatal error was reported —
`npx -y @tanstack/intent install` (an AI-agent skill-discovery helper) did not
run; it is not needed to build or run the app.

## Key files

| Path | Purpose |
|------|---------|
| `package.json` | Dependencies + scripts. `dev` = `vite dev --port 3000`, `build` = `vite build`, `preview` = `vite preview`, `generate-routes` = `tsr generate` |
| `vite.config.ts` | Vite config. Plugins: `@tailwindcss/vite`, `@tanstack/react-start/plugin/vite` (`tanstackStart()`), `@vitejs/plugin-react`, TanStack devtools. `resolve.tsconfigPaths: true` |
| `tsconfig.json` | TypeScript compiler options — `strict: true`, bundler module resolution, path aliases `#/*` and `@/*` → `./src/*` |
| `src/styles.css` | Global stylesheet. Tailwind v4 CSS-first: `@import "tailwindcss";` — **no `tailwind.config.ts`** (correct for v4) |
| `src/router.tsx` | Builds the TanStack Router instance (`getRouter()`), registers types |
| `src/routes/__root.tsx` | Root route / document shell (`<html>`, `<head>`, `<body>`), loads `styles.css`, mounts devtools |
| `src/routes/index.tsx` | The `/` route — starter "Welcome to TanStack Start" page |
| `src/routeTree.gen.ts` | Auto-generated route tree (do not edit by hand) |
| `tsr.config.json` | TanStack Router generator config (`target: react`) |

Tailwind wiring confirmed:
- `src/styles.css` contains `@import "tailwindcss";`
- `vite.config.ts` plugins array includes `tailwindcss()`
- No `tailwind.config.ts` exists, and none is required for Tailwind v4.

## How I verified

1. `npm install` — already run by the CLI; `node_modules/` present.
2. `npm run dev` from the project root.
3. Terminal printed: `VITE v8.2.2 ready` and `Local: http://localhost:3000/`.
4. Opened **http://localhost:3000/** — the starter page rendered, no crash.
5. Checked server-rendered first paint: `curl http://localhost:3000/` returns
   HTTP 200 and the response HTML already contains
   `<h1 ...>Welcome to TanStack Start</h1>` — proof the page is
   server-rendered, not a blank client-only shell.
6. Stopped the dev server with `Ctrl+C`.

## Layout notes for later steps

- Application source lives under `src/`.
- **Routes are file-based under `src/routes/`.** Step 4 maps the route tree;
  Step 5 adds `/players` and `/games`; Step 7 adds `/players/$playerId`.
- `src/routes/__root.tsx` is where the shared nav / root layout goes.
- `src/routeTree.gen.ts` is regenerated automatically by the dev server (or
  `npm run generate-routes`) — never edit it directly.
- Requirements live in `docs/requirements-brief.md`.

## Issues hit

- `@tanstack/intent install` failed during scaffold (agent-tooling helper) —
  ignored; does not affect the app.
- The CLI overwrote the placeholder `README.md` and `.gitignore` from Step 1.
  Re-added a project header to `README.md` and appended `.vercel` / `*.log` to
  the CLI's `.gitignore`.
- Node warning `Accessing non-existent property 'replaceRouteChunk'` printed
  during route-tree generation — known upstream noise, build/run unaffected.
