---
status: active
last-reviewed: 2026-08-14
---

# Reference catalog

This catalog answers "what must I read for this change?" It is scoped to the
Cursor Slides project and should be updated when upstream adds a new governing
document or moves a subsystem.

## Required for every Cursor change

<!-- markdownlint-disable MD013 -->

| Source                                     | Why it is required                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| `AGENTS.md`                                | Personal-fork product scope, branches, installed-app safety, and integration boundaries |
| Closest applicable nested `AGENTS.md`      | Directory-specific implementation or documentation rules                                |
| `docs/cursor/README.md`                    | Navigation, authority order, and current decisions                                      |
| Relevant files in `docs/cursor/`           | Requirements, architecture, task order, and verification for the change                 |
| Accepted `docs/adr/*`                      | Durable decisions that implementation must preserve                                     |
| `CONTRIBUTING.md`                          | Language, checks, layout, commit, test, and fidelity rules inherited from upstream      |
| `SECURITY.md`                              | Electron/IPC and AI-generated-content trust boundaries                                  |
| `LICENSE`, `NOTICE`, `LICENSE-UNICODE.txt` | Open-source obligations that remain applicable to a fork                                |
| Existing tests around changed behavior     | Executable compatibility and fidelity contract                                          |

<!-- markdownlint-enable MD013 -->

The upstream licenses, security policy, contributor rules, and tests are not
"optional reference material" merely because this is a personal fork.

## Required by change type

<!-- markdownlint-disable MD013 -->

| Change                      | Read before editing                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Slides renderer/UI          | `apps/slides/AGENTS.md`, `CLAUDE.md`, `packages/ui/src/tokens.css`, relevant Slides component/styles/tests              |
| Slides main/preload/IPC     | `apps/slides/AGENTS.md`, `CLAUDE.md` build gotchas, shared IPC types, preload, handlers, session state, and IPC tests   |
| Cursor worker/SDK           | `apps/slides/AGENTS.md`, `docs/cursor/ARCHITECTURE.md`, ADR 0002, official Cursor SDK docs, package lock/license policy |
| Agent tools                 | `apps/slides/AGENTS.md`, ADR 0003, current `slides-skill.ts` as behavior reference, main services, history and layout tests |
| Undo/session state          | `apps/slides/AGENTS.md`, `apps/slides/src/main/session-state.ts`, Slides history and undo-routing tests                 |
| PPTX read/write             | Relevant `packages/pptx-engine` code, fixture README, fidelity/round-trip tests, root README's preservation promise     |
| Shell build or packaging    | `CLAUDE.md`, `apps/shell/electron.vite.config.ts`, `apps/shell/electron-builder.cjs`, ADR 0001, licenses/notices        |
| Authentication/secrets      | `SECURITY.md`, current Cursor auth docs, OS/profile storage code, redaction tests                                       |
| Upstream sync               | `docs/cursor/README.md` branch convention, `CONTRIBUTING.md` mirror model, Git history/diff for the incoming snapshot   |
| Local setup/two-Mac use     | `docs/cursor/OPERATIONS.md`, ADR 0001, current remotes and app identity code                                            |
| Cursor source-of-truth docs | `docs/cursor/AGENTS.md`, this catalog, the owning document, related ADRs, code, and tests                               |

<!-- markdownlint-enable MD013 -->

Always consult the current SDK documentation during implementation. SDK
runtime, authentication, model catalog, sandbox, tool, and packaging behavior
can change independently of this repository.

## Useful background references

These describe the current system but do not override fork requirements:

- `README.md`: upstream product and repository overview
- `packages/agent-core`: current GenOffice renderer-side agent loop
- `packages/ai-provider`: raw model streaming abstraction used by the existing
  path, not the target home for Cursor SDK
- `packages/ai-search`: Genspark/search implementation retained only as current
  behavior reference for this MVP
- `apps/slides/src/renderer/ai/AiPanel.tsx`: current AI UI and `DeckAccess`
  wiring
- `apps/slides/src/renderer/ai/transport.ts`: current renderer-to-main raw model
  stream
- `apps/slides/src/renderer/ai/slides-skill.ts`: current tool vocabulary and
  validation ideas; its generation prompts and cloud tools are not reusable as
  Genspark-independent requirements
- `apps/slides/src/main/ai-ipc.ts`: current Genspark-normalized settings and
  model stream
- `apps/slides/src/main/slides-main.ts`: existing authoritative handlers to
  extract, not duplicate
- `packages/pptx-render`: render-state contract returned after edits
- [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript): live SDK
  behavior and API
- [Electron utility process](https://www.electronjs.org/docs/latest/api/utility-process):
  worker host lifecycle and message API

## Deferred until a task enters that scope

- `apps/sheets/docs/*` and the Rust XLSX sidecar documentation: read when the
  Slides MVP passes and Sheets planning begins.
- Docs/pagination/Word fidelity guides: read only when Docs enters scope.
- PDF and Markdown implementation documents: read only for those apps.
- `docs/superpowers/specs/2026-08-05-update-channel-design.md`: upstream public
  update-channel design. The personal build deliberately has no updater.
- `ee/README.md` and `ee/LICENSE`: the enterprise tree is outside this project;
  read before any contemplated `ee/` change, which is currently prohibited.
- Platform packaging details for Windows/Linux: deferred while the personal
  target is the owner's two Macs, except when shared builder changes could
  regress them.

## Do not use as a requirement source

- Stale chat summaries or uncommitted scratch notes
- The marketing behavior of a released Genspark-backed build
- Model names remembered from Cursor Editor without checking
  `Cursor.models.list()` for the current account
- Skills merely present on disk but not explicitly selected and compatibility
  checked
- Cursor SDK subagent or `generate_deck` examples as a reason to widen this
  fork's worker allowlist
- Generated artifacts in `apps/*/out`, `release`, `.task`, SDK stores, or user
  data directories

When a useful chat decision is not represented here, add it to the appropriate
source-of-truth document or ADR before implementation relies on it.
