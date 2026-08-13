# Cursor integration workspace

## Purpose

This fork is a personal GenOffice workspace that will use the Cursor Agent SDK
as an optional AI backend. The target experience is to give natural-language
instructions, invoke reusable slide-generation skills, and create or edit
native PPTX/XLSX/DOCX content through GenOffice's existing editors.

The SDK is an agent runtime and tool orchestrator, not an Office file-format
API. GenOffice remains responsible for document state, rendering, validation,
undo/redo, and OOXML import/export. The agent reaches those capabilities
through small typed tools hosted in the Electron main process.

This commit establishes the development workspace only. Cursor SDK execution
and editor tools have not been implemented yet.

## Repository layout and branches

- Working copy: `/Users/ryukouokumura/Desktop/boss-workspace/genoffice-remake`
- `upstream`: official read-only `genspark-ai/genoffice`
- `origin`: personal `RYUKOU-OKUMURA/genoffice-remake` fork
- `main`: clean mirror of `upstream/main`
- `cursor`: persistent personal integration branch
- `feature/*`: short-lived branches created from `cursor`

## Syncing an upstream release

Start with a clean working tree:

```bash
git fetch upstream --tags --prune
git switch main
git merge --ff-only upstream/main
git push origin main
git switch cursor
git merge main
npm run typecheck
npm test
git push origin cursor
```

The test commands intentionally run after merging into `cursor`: a clean
fast-forward of `main` only proves Git compatibility, while the custom branch
is where integration regressions can occur. Resolve conflicts on `cursor`, not
on `main`.

## Local development baseline

Required locally:

- Node.js 22.13 or newer and npm 10 or newer
- Rust/Cargo for the Sheets XLSX sidecar

Initial setup:

```bash
npm install
npm run fixtures
npm run typecheck
npm test
```

Run the complete desktop development environment with `npm run dev`. GenOffice
can run without Genspark credentials; the future Cursor backend must remain an
independent provider choice rather than being added inside the OOXML engines.

## Intended implementation boundary

Keep the first implementation small and easy to rebase onto upstream:

1. Add an isolated Cursor SDK host package.
2. Add thin Electron main-process bridges for Slides and Sheets.
3. Register allowlisted local custom tools that call existing editor commands.
4. Add a provider selector and Cursor session/auth status UI.
5. Load compatible skills through an explicit local skills directory.
6. Add undoable end-to-end creation and editing tests before expanding tools.

Skills written for the Cursor editor may assume IDE-only tools or workspace
paths. Treat them as portable only when their instructions and dependencies
are available to the SDK process; otherwise adapt them behind the same typed
GenOffice tool interface.

## Safety constraints

- Do not send local custom tools to a cloud-mode agent configuration.
- Use the SDK sandbox and the narrowest practical allowlist.
- Validate every model-generated tool argument inside the handler.
- Require confirmation for external network writes, destructive file actions,
  or operations outside the active document.
- Store credentials outside Git and redact them from logs.

