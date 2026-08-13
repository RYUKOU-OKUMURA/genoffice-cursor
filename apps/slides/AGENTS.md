# Cursor Slides Implementation Instructions

These instructions apply to `apps/slides/**` and extend the repository root
instructions. Read them explicitly when a task starts at the repository root.

## Required context

- Read `docs/cursor/SLIDES_MVP_REQUIREMENTS.md`, `ARCHITECTURE.md`, the active
  phase in `IMPLEMENTATION_PLAN.md`, and the relevant section of `TEST_PLAN.md`
  before implementation.
- Inspect `src/main/session-state.ts`, the relevant handlers in
  `src/main/slides-main.ts`, shared/preload IPC types, and existing tests before
  designing a mutation.
- The current renderer `AiPanel`, `@genoffice/agent-core` loop, generic `ai:*`
  transport, and `slides-skill.ts` describe the existing Genspark-backed path.
  They are reference behavior, not the target Cursor runtime.

## Backend boundary

- Cursor is a separate `AgentBackend`, not another `AiProviderId`. Do not place
  the SDK inside `@genoffice/ai-provider` or route it through `ai:stream`.
- Use a dedicated `cursor:*` renderer/preload/main IPC namespace. The shell
  registers generic `ai:*` handlers globally, so reusing those names is a
  correctness bug.
- Do not import `@cursor/sdk` in a renderer, preload, or bundled Electron main
  entry. The SDK runs in the isolated utility-process worker defined by ADR
  0002 and communicates through the versioned broker protocol.
- Local mode is mandatory for document tools. Configure only `tools: ["mcp"]`,
  the private `local.customTools` map, and the enabled sandbox. Do not provide
  `mcpServers`, `local.settingSources`, or `agents`; do not include `"task"`
  in `tools`. Reapply restrictions on resume.
- Treat SDK sandbox and auto-review as defense in depth. The authorization
  boundary is the Electron main broker with runtime schemas, limits, run/deck
  capabilities, and a closed tool-name allowlist.
- A custom-tool callback may only send a typed broker request and await its
  result. It cannot access document paths, Electron objects, or editor state.

## Session, mutation, and history invariants

- The main-process `Session` is the deck source of truth. Pin a run to the
  initiating `webContents.id`, exact session object, run ID, and opaque
  capability; never resolve the target again from current focus.
- Reject late or forged requests after cancellation, renderer destruction,
  deck/session replacement, worker restart, timeout, or terminal run state.
- Extract small command services that accept an explicit `Session`. Existing
  manual IPC and Cursor tools must call the same mutation implementation.
- Main validates indices, element IDs, editability, finite geometry, canvas
  bounds, colors, enums, text/payload size, call budget, and returned state.
  Worker-side schema checks never replace main-side validation.
- Begin one existing history batch per mutating run. End or settle it exactly
  once on success, failure, cancellation, timeout, worker exit, renderer close,
  and session replacement. A run with edits becomes one undo step.
- Send fresh affected-slide/deck state only to the initiating renderer and keep
  manual undo/redo, dirty state, AI snapshots, rendering, and save semantics.

## Initial MVP tool surface

The initial allowlist is limited to:

- `get_deck_context`
- `read_slide`
- `set_element_text`
- `add_text_box` and `add_shape` with a small preset allowlist, for bounded
  tweaks on an existing slide
- `add_diagram` with supported, bounded SmartArt-style shape-group layouts
- `compose_slide` with layout ids `title_kicker`, `input_cycle_outputs`,
  `insight_table`, and `bar_comparison` as the from-scratch creation path.
  Tables and bar charts are inserted only inside those templates. Numeric
  values must appear in the initiating user prompt.

Do not expose or silently fall back to:

- `generate_deck`, `regenerate_slide`, `slides:cloud-page-generate`, GSK
  search/image/media tools, or the `cloudpptx:` import path;
- `add_table` or `add_chart` as Cursor custom tools;
- `execute_slide_script`, arbitrary HTML/OOXML, arbitrary geometry names,
  arbitrary URLs, arbitrary save paths, shell, filesystem, web, ambient MCP,
  SDK `agents`, `"task"`, or other subagent capability; or
- direct archive writes or renderer-only `window.slidesApi` callbacks from the
  worker.

From-scratch creation must call `compose_slide`. Do not assemble a whole slide
from primitives, and do not compensate for missing templates with subagents.
See [ADR 0003](../../docs/adr/0003-quality-first-native-slide-composition.md).

The current scratch-build guard in `slides-skill.ts` is Genspark product policy,
not an engine limitation. Cursor native creation uses separately validated main
services and must not weaken that existing path's tests.

## Authentication, privacy, UI, and skills

- Credentials and the SDK stores remain in the worker/personal `userData`
  boundary. A renderer receives only status, account-safe metadata, catalog
  models, run events, and redacted errors.
- Discover models with `Cursor.models.list()`; never hard-code Grok or another
  model as permanently available.
- Before the first run, disclose Cursor-hosted inference and the bounded prompt,
  deck context, and tool results sent to it. Never send raw PPTX bytes,
  unrelated slides, file paths, or unrelated local files.
- Follow root `CLAUDE.md`: use semantic theme tokens, i18n all user-facing
  strings, and rebuild shell/preload output when the changed process requires
  it.
- The MVP skill path is GenOffice-managed instruction injection. Validate and
  copy an explicitly approved, bounded `SKILL.md` and supported text assets;
  ignore `.cursor` config, MCP, hooks, agents, executables, and scripts. A skill
  never expands tools or SDK setting sources.

## Verification and review

- Add deterministic tests for protocol validation, stale capabilities,
  cancellation/crash cleanup, argument bounds, command parity, and history.
- Preserve existing Slides history, layout, generation, regeneration, picture,
  and undo-routing tests even though Genspark is not the Cursor dependency.
- Creation acceptance requires blank deck -> `compose_slide` for each MVP
  layout id -> figure-gate rejection without user numbers -> one-step
  undo/redo -> Save As -> reopen -> structural and visual verification.
- Run focused checks while iterating:

  ```bash
  npm run typecheck -w @genoffice/slides
  npm run test -w @genoffice/slides
  npm run typecheck -w @genoffice/pptx-engine
  npm run test -w @genoffice/pptx-engine
  ```

- Also run the future `@genoffice/cursor-agent` checks once that workspace
  exists. At every phase exit, run the broader gates in the root instructions
  and record live Cursor acceptance separately from deterministic CI tests.

Reject review if the change widens privileges, bypasses main session/history,
mixes Cursor into generic `ai:*`, introduces a Genspark dependency into Cursor
acceptance, or claims PPTX fidelity without round-trip evidence.
