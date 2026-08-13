# GenOffice Cursor Repository Instructions

These fork-owned instructions apply to the entire repository. Upstream does
not currently provide an `AGENTS.md`; do not replace this file with upstream
product documentation during a sync.

## Start with the source of truth

- Read `docs/cursor/README.md` before planning Cursor integration work, then
  follow its authority order and `REFERENCE_CATALOG.md` routing.
- Treat `docs/cursor/SLIDES_MVP_REQUIREMENTS.md` as the user-visible contract,
  `ARCHITECTURE.md` as the target boundary, `IMPLEMENTATION_PLAN.md` as the
  dependency order, and `TEST_PLAN.md` as the evidence contract.
- Target documents describe intended behavior that may not exist yet. Inspect
  current code and tests before claiming a feature is implemented.
- Apply the closest nested `AGENTS.md` for specialized work. A session started
  at the repository root must explicitly read:
  - `apps/slides/AGENTS.md` before changing Slides or the Cursor agent path.
  - `docs/cursor/AGENTS.md` before changing `docs/cursor/**` or `docs/adr/**`.
- Follow `CONTRIBUTING.md` for upstream repository conventions and `CLAUDE.md`
  for UI theming and Electron build gotchas.

## Product scope

- This is a private, personal-use fork for the owner's Macs. Do not add public
  distribution, public branding, or an update service unless explicitly
  requested.
- The current MVP is Slides only. Do not implement Cursor tools for Sheets,
  Docs, PDF, or Markdown until every Slides acceptance scenario passes.
- The primary path must work with a Cursor account while Genspark is logged
  out and GSK credentials are absent. Existing upstream Genspark behavior may
  remain as an optional compatibility path but is not an MVP dependency.
- GenOffice remains authoritative for document state, rendering, undo/redo,
  and OOXML import/export. Agents call narrow commands; they never write PPTX,
  XLSX, or DOCX archives directly.
- Prefer native, editable Office content. The initial Slides diagram is an
  editable shape group, not a bitmap and not semantic PowerPoint SmartArt.

## Git and upstream safety

- `origin` is `RYUKOU-OKUMURA/genoffice-cursor`; `upstream` is the fetch-only
  official `genspark-ai/genoffice` repository.
- Keep `main` as a clean fast-forward mirror of `upstream/main`. Put all fork
  work on `cursor` or focused `feature/*` branches created from `cursor`.
- Merge upstream snapshots into `cursor`; resolve conflicts there. Do not add
  fork commits to `main`, rebase published branch history, force-push, or push
  to the official repository.
- Before every push, verify the branch and `git remote -v`. Keep the installed
  hook synchronized with `tools/git-hooks/pre-push-fork-safety`; install it on
  each new checkout as documented in `docs/cursor/OPERATIONS.md`.
- Preserve unrelated user changes in a dirty worktree. Commit small, focused
  changes with imperative English subjects.

## Installed app and local-data safety

- Source changes do not update the official installed `GenOffice.app`.
- During MVP development, run the fork unpackaged with:

  ```bash
  GENOFFICE_USER_DATA="$PWD/.task/user-data" npm run dev
  ```

- Do not package or install the fork until Phase 7 and ADR 0001's separate
  product name, bundle ID, and explicit user-data path are implemented.
- Never use the official GenOffice update feed in a personal build.
- Test with generated fixtures or copies. Never open and save the same PPTX
  concurrently in the official and personal apps.
- Never commit credentials, SDK stores, local skills, user documents, logs
  containing document content, or `.task/user-data` state.

## Change discipline

- Work in the phase order in `docs/cursor/IMPLEMENTATION_PLAN.md`. Do not widen
  the tool surface until the preceding exit gate passes.
- Keep Cursor integration additive and isolated so upstream engine updates can
  merge cleanly. Extract shared command services instead of duplicating or
  bypassing existing editor mutations.
- Do not edit generated output or dependency trees such as `apps/*/out`,
  `release`, or `node_modules`. Regenerate them through repository commands
  only when the task requires it.
- Use `npm ci` for a clean install. Use `npm install` only for an intentional
  dependency change, and review the lockfile and license impact.
- Code, comments, commit messages, and developer docs are English-only;
  user-facing text belongs in i18n resources.
- When the user corrects a recurring assumption, update the owning
  `docs/cursor/` document or an ADR. Update `AGENTS.md` only when the correction
  should govern future work every time.
- When subagents are available, use them for bounded independent research and
  require an independent final review before committing any non-trivial change.

## Verification and handoff

- While iterating, run the smallest relevant workspace typecheck and tests.
- Before a code commit, run formatting, lint, affected workspace typechecks,
  and affected tests. Run the full gates required by `CONTRIBUTING.md` at phase
  exits or when shared dependencies/build paths change.
- OOXML open/save changes require a round-trip test proving intended changes
  and preservation of untouched content.
- Documentation-only changes require `npm run format:check`, valid local links,
  and consistency with current code, ADRs, and the implementation plan.
- Treat warnings as evidence to report even when the command exits zero. In the
  final handoff, list commands run, results, and any intentionally skipped
  checks.

## Code review rules

Treat these as blockers:

- A Cursor acceptance path silently calls Genspark.
- The worker gains arbitrary shell, filesystem, ambient MCP, network-tool, or
  subagent capability.
- A renderer receives a credential or can mutate a deck outside typed preload
  and main-process validation.
- A run can retarget after a tab/deck change or leave history batching open.
- A personal package can replace the official app, share its user data, or use
  its update feed.
- An agent mutation bypasses existing command, undo, render, or save behavior.
