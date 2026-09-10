# Workspace checklist — Hockey Ops Player Directory

Date completed: 2026-09-09

## Tools

| Item | Value |
|------|--------|
| Operating system | Windows 11 Pro (build 10.0.26200) |
| Code editor | Visual Studio Code 1.116.0 |
| Editor can open a whole folder? | Yes |
| Terminal app used | VS Code integrated terminal on Windows 11 — Git Bash and PowerShell |

## Project home

- **Project folder name:** hockey-player-directory
- **Full path on this machine:** `C:\Users\sangc\src\proj\hockey-player-directory`
- **`docs/requirements-brief.md` present in this folder?** Yes — `docs/requirements-brief.md`, committed in `29ddaf4`

> Note: the folder is named `hockey-player-directory` (not the tutorial's example
> `hockey-ops-directory`). It was created and pushed to GitHub in Step 1, so the
> name is kept consistent across all later steps.

## Node.js and npm

Run these in a terminal whose working directory is the project folder:

```text
node -v
npm -v
```

| Command | Output I saw | OK? |
|---------|----------------|-----|
| `node -v` | v22.16.0 | Yes |
| `npm -v` | 10.9.2 | Yes |

- **Node install source (if I installed today):** already installed (Node 22.x, an active LTS line)
- **I closed and reopened the terminal after installing Node:** N/A — Node was already present

## Smoke checks (safe commands)

| Check | Command idea | What I observed |
|-------|----------------|-----------------|
| Where am I? | `pwd` (Git Bash) / `cd` alone (PowerShell) | `/c/Users/sangc/src/proj/hockey-player-directory` |
| List project files | `ls` / `dir` | `docs/`, `README.md`, `.gitignore` (and `.git/`) |
| Brief readable | Open `docs/requirements-brief.md` in the editor | Actors, four routes, and acceptance criteria still make sense |

## Blockers and notes

- Node.js and npm were already installed and on PATH — no install needed.
- Installed the GitHub CLI (`gh`) for Step 1's push. It was not recognized in the
  terminal that was already open; opening a **new** terminal picked it up. Same
  "reopen the terminal after installing a tool" lesson the step warns about.
- `git` 2.49.0 is installed; the repo was initialized on branch `main` in Step 1.

## Ready for scaffolding?

- [x] Editor opens this project folder
- [x] Terminal working directory is the project folder
- [x] `node -v` and `npm -v` both print versions
- [x] `docs/requirements-brief.md` is in the project
- [x] I know I will run future install commands only from this folder unless a step says otherwise

**Sign-off:** I can explain what a project folder, a path, the terminal, Node.js, and npm are in one sentence each before Step 3.

- **Project folder:** a single named directory on disk that holds every file for this app — docs now, source code later.
- **Path:** the full address of a file or folder on this machine, e.g. `C:\Users\sangc\src\proj\hockey-player-directory`, used by the terminal to know what I mean.
- **Terminal:** a text window where I type short commands to inspect the folder and run tools instead of clicking.
- **Node.js:** the runtime that executes JavaScript/TypeScript outside a browser, including the dev server and the server-side rendering this sprint needs.
- **npm:** the package manager bundled with Node.js that downloads and manages the libraries the project depends on (like TanStack Start).
