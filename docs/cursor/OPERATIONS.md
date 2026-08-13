---
status: active
last-reviewed: 2026-08-13
---

# Development and operations

## Installed applications and source changes

Both development Macs already have the official `GenOffice.app` installed.
Cloning, pulling, committing, or pushing this source repository never updates
that installed application. A source change appears only in a development
process started from the checkout, or in a personal package that is rebuilt
and installed deliberately.

Keep the official app installed during MVP work. Run the fork unpackaged with
an isolated profile:

```bash
GENOFFICE_USER_DATA="$PWD/.task/user-data" npm run dev
```

This separates GenOffice-managed user data and Electron's single-instance lock
from the installed application. It does not relocate credentials owned by an
external Cursor installation. The Cursor integration must explicitly keep its
own auth and agent stores below this fork's `userData` path.

Do not install a package produced with the current upstream identity. Until
Phase 7 of `IMPLEMENTATION_PLAN.md`, it still uses the `GenOffice` product name,
`com.genoffice.app` bundle ID, and the packaged app's normal user-data path. It
could replace the official app or share preferences, recent files, autosaves,
AI settings, projects, and locks.

## Repository layout

- Working copy:
  `/Users/ryukouokumura/Desktop/boss-workspace/genoffice-cursor`
- `origin`: personal `RYUKOU-OKUMURA/genoffice-cursor` fork, fetch and push
- `upstream`: official `genspark-ai/genoffice`, fetch only
- `main`: clean fast-forward mirror of `upstream/main`
- `cursor`: persistent personal product branch
- `feature/*`: focused branches created from `cursor`

The local pre-push hook blocks the official upstream name and URL. It is a
last line of defense, not a substitute for checking `git remote -v`. Hooks are
not cloned automatically, so install the tracked guard on every new checkout
before the first push:

```bash
install -m 755 tools/git-hooks/pre-push-fork-safety \
  "$(git rev-parse --git-path hooks/pre-push)"
```

## Initial setup on a Mac

Requirements are Node.js 22.13 or newer, npm 10 or newer, and Rust/Cargo for
the Sheets sidecar built by the full app even though the MVP is Slides-only.

```bash
cd /Users/ryukouokumura/Desktop/boss-workspace
git clone https://github.com/RYUKOU-OKUMURA/genoffice-cursor.git
cd genoffice-cursor
git remote add upstream https://github.com/genspark-ai/genoffice.git
git remote set-url --push upstream DISABLED
git switch cursor
npm ci
npm run fixtures
```

Before pushing, run the guard installation command above and test it against
both official HTTPS and SSH URLs. Never put a credential, SDK store, skill
state, or user document in Git.

## Syncing an upstream release

Start with a clean working tree. Keep custom commits off `main`:

```bash
git fetch --prune --tags origin
git fetch --prune --tags upstream
git switch main
git pull --ff-only origin main
git merge --ff-only upstream/main
git push origin main
git switch cursor
git merge main
npm run typecheck
npm test
git push origin cursor
```

A fast-forward on `main` proves only Git compatibility. Resolve any integration
conflict on `cursor`, then verify the custom branch before pushing it. Because
upstream publishes snapshot-style changes, update at a deliberate checkpoint
and review the complete incoming diff rather than auto-installing untested
source changes into the personal app.

## Two-Mac workflow

- Synchronize source through `origin/cursor`; pull and run or build on each Mac
  independently.
- Cursor authentication, SDK state, app settings, recent files, autosaves,
  projects, and enabled skills stay local to each Mac. Migrate only selected,
  trusted settings or skills, never an entire user-data directory.
- Build for the target architecture. A package built for Apple Silicon is not
  assumed to run on an Intel Mac, or vice versa.
- Never open and save the same PPTX concurrently in the official and personal
  apps. Use a copy for validation to avoid last-writer-wins loss or corruption.
- After both apps are installed, choose the preferred default application for
  PPTX files in macOS explicitly.

## Personal packaged application

The first installable personal build begins only after the package identity in
[ADR 0001](../adr/0001-separate-personal-app-identity.md) is implemented:

- application name: `GenOffice Cursor.app`
- bundle identifier: `com.ryukouokumura.genoffice.cursor`
- explicit packaged user-data path:
  `~/Library/Application Support/GenOffice Cursor`
- no official GenOffice update feed or `app-update.yml`

The official app then continues receiving its official updates independently.
The personal app does not change when source is pushed; without a separate
private updater, rebuild and reinstall it on each Mac to deploy a revision.
The current project has no requirement to publish or distribute that package.
