# Repository setup — Hockey Ops Player Directory

**Author:** sangchunahn
**Date:** 2026-09-10
**Repository URL:** https://github.com/sangchunahn/hockey-player-directory
**Visibility:** private (instructor `thortek` added as a collaborator)
**Default branch:** main

## 1. Ignore rules in place before first commit

`.gitignore` (project root):

```text
node_modules
.DS_Store
dist
dist-ssr
*.local
.nitro
.tanstack
.wrangler
.output
.vinxi
__unconfig*
todos.json

# Env files — never commit real secrets. .env.example IS tracked (Sprint 2).
.env
.env.*
!.env.example

# Deploy / misc
.vercel
*.log
npm-debug.log*
```

`.gitignore` existed before my first commit: **YES** — the first commit
(`29ddaf4`, the requirements brief) added `.gitignore` alongside it, before any
`node_modules/` or scaffold files were ever staged. The TanStack CLI later
replaced it with its own version during scaffolding; the two were merged and the
env/`.vercel`/`*.log` lines re-added.

**Why `.gitignore` must come first:** Git only ignores files it is *not already
tracking*. If `node_modules/` or a real `.env` is committed once, adding it to
`.gitignore` afterward does nothing — the file stays in history, and `git rm
--cached` only removes it going forward, not from past commits. A leaked key in
history is still readable after the file is "deleted".

## 2. Repository initialized

```text
$ git init -b main
Initialized empty Git repository in C:/Users/sangc/src/proj/hockey-player-directory/.git/

$ git branch --show-current
main
```

## 3. Pre-stage status review

Before the first `git add`, `git status` listed only source and config —
`docs/`, `README.md`, `.gitignore`. It did **not** list `node_modules/`, `.env`,
`dist/`, or `.output/`. After the scaffold step, `git status` was checked again:

```text
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

- `node_modules/` absent from tracked files: **PASS**
- `.env` / `.env.local` absent: **PASS**
- Build output (`dist/`, `.output/`) absent: **PASS**

## 4. First commit

- Commit command used: `git commit -m "Add Sprint 1 requirements brief for hockey ops player directory"`
- Full history (oldest first): `29ddaf4` brief → `7365a0e` / `21c7425` workspace
  checklist → `167bbf2` TanStack Start scaffold → `064e13a` route map →
  `8d11d0c` static routes → `323133b` dynamic route → `b8d885f` search params →
  `6eee346` SSR loaders → `89cf4c4` cross-links → `22e1f5d` acceptance checklist
- Working tree clean afterward: **PASS**

## 5. Remote and push

```text
$ git remote -v
origin  https://github.com/sangchunahn/hockey-player-directory.git (fetch)
origin  https://github.com/sangchunahn/hockey-player-directory.git (push)
```

- Created the GitHub repo **empty** with `gh repo create hockey-player-directory
  --private --source . --remote origin --push` (no README/.gitignore/license
  added on GitHub, so the first push was not rejected).
- `git push -u origin main` completed without error: **PASS** — `git status` now
  reports `Your branch is up to date with 'origin/main'`.

**What `origin` and `-u` mean:** `origin` is the local name for the GitHub copy
of the repo (the URL above). `git push -u origin main` pushed the `main` branch
there and set it as the upstream, so later pushes are just `git push`.

## 6. Browser / API verification (the real proof)

Verified via `gh api` against `repos/sangchunahn/hockey-player-directory`:

| Check | Result |
| --- | --- |
| Source files visible on the repo (`src/`, `package.json`, `vite.config.ts`, `tsconfig.json`, `docs/`, …) | **PASS** |
| No `.env` file in the repository (`contents/.env` → 404 "Not Found") | **PASS** |
| No `node_modules` folder in the repository (`contents/node_modules` → 404) | **PASS** |
| Commit messages readable in the commit list | **PASS** |
| Default branch is `main`, visibility `PRIVATE` | **PASS** |

Top-level tree on `main`: `.cta.json`, `.gitignore`, `.vscode`, `README.md`,
`docs`, `package-lock.json`, `package.json`, `src`, `tsconfig.json`,
`tsr.config.json`, `vite.config.ts`.

## 7. Issues and fixes

| Issue | What I tried | Outcome |
| --- | --- | --- |
| `gh` not on PATH in the already-open terminal after install | Opened a new terminal / used the full path | Resolved; `gh auth login` via browser succeeded |
| TanStack CLI overwrote the Step 1 `.gitignore` and `README.md` during scaffold | Merged the CLI's ignore rules with the env/deploy lines; re-added a project header to the README | Resolved before the scaffold commit |

## 8. Ready for Sprint 2

Sprint 2 will add env-variable separation and commit `.env.example`. This repo
is ready: ignore rules for `.env` / `.env.*` are already in place (with
`!.env.example` un-ignored), and **no secret has ever been committed** — the
project holds no Supabase keys or credentials yet. **YES.**
