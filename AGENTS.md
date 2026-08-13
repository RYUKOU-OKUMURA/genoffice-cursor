# GenOffice Cursor Fork Instructions

These instructions apply to the entire repository.

## Product goal

- This is a personal-use fork. Do not add public distribution, branding, or
  update-feed work unless explicitly requested.
- Add Cursor Agent SDK as an optional agent backend for natural-language
  creation and editing of presentations, spreadsheets, and documents.
- Keep GenOffice's existing OOXML editors and engines authoritative. The
  Cursor agent should call narrow editor tools; it is not a replacement for
  the PPTX, XLSX, or DOCX engines.
- See `docs/CURSOR_INTEGRATION.md` before changing the agent architecture.

## Git workflow

- `upstream` is the read-only official `genspark-ai/genoffice` repository.
- `origin` is the personal `RYUKOU-OKUMURA/genoffice-remake` fork.
- Keep `main` as a clean fast-forward mirror of `upstream/main`. Never put
  custom commits on `main`.
- Keep personal product work on `cursor`; create `feature/*` branches from
  `cursor` for non-trivial changes.
- Merge new `main` snapshots into `cursor`. Do not rewrite published branch
  history to resolve upstream conflicts.
- Make small, focused commits with imperative English subjects.

## Cursor integration boundaries

- Prefer a new, isolated workspace package for the Cursor SDK host and thin
  Electron main-process bridges in the apps that expose editor operations.
- Expose typed, narrow tools such as text replacement, slide element changes,
  or bounded cell-range edits. Do not expose arbitrary filesystem or shell
  execution to model-generated arguments.
- Validate document identity, ranges, object IDs, paths, and payload sizes in
  every tool handler. Keep an allowlist and explicit approval gates for
  sensitive operations even when running locally.
- Never commit Cursor credentials, Genspark credentials, access tokens, or
  user documents. Put secrets in the OS credential store or ignored local
  environment files.
- Cursor SDK integration requires Node.js 22.13 or newer.

## Verification

- Follow `CONTRIBUTING.md` for repository-wide requirements.
- Run focused tests while iterating, then run formatting, lint, typecheck, and
  the relevant workspace tests before committing.
- Changes to OOXML open/save behavior require round-trip coverage that proves
  untouched content is preserved.
