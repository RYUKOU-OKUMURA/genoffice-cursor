---
status: ready
last-reviewed: 2026-08-14
---

# Slides Cursor implementation plan

This is the executable work plan for the first vertical slice. Check items only
after their exit gate passes; do not use task completion as a substitute for
the acceptance scenarios in `SLIDES_MVP_REQUIREMENTS.md`.

## Dependency sequence

```mermaid
flowchart LR
    P0["0. Baseline and docs"] --> P1["1. SDK worker spike"]
    P1 --> P2["2. Read-only backend"]
    P2 --> P3["3. Undoable text edit"]
    P3 --> P4["4. Composed native slide"]
    P4 --> P5["5. Trusted skill"]
    P5 --> P6["6. MVP hardening"]
    P6 --> P7["7. Personal packaged beta"]
```

Phases 0-6 define the unpackaged Slides MVP. Phase 7 makes it a daily-use app
that can coexist with the official installation. Multi-slide generation is
post-MVP work after Phase 6, not a numbered phase in this sequence.

## Phase 0: baseline and source of truth

Goal: preserve a known-good upstream baseline and make the scope reviewable.

- [x] Keep `main` as an upstream mirror and personal work on `cursor`.
- [x] Add a push guard for the official upstream remote and URL.
- [x] Document official-app/profile isolation and separate package identity.
- [x] Classify required, conditional, reference-only, and out-of-scope docs.
- [x] Record Slides MVP requirements, architecture, implementation plan, and
      test plan.
- [x] Record fresh baseline results for Slides typecheck/tests and repository
      checks immediately before implementation begins.

Exit gate: clean `cursor` worktree, personal `origin`, fetch-only `upstream`,
and the baseline evidence recorded in the first implementation change.

## Phase 1: SDK utility-process spike

Goal: prove SDK authentication, runtime isolation, tools, events, and packaging
assumptions before touching the Slides UI.

Planned work:

- [ ] Create `packages/cursor-agent` with Node >=22.13 engines, build,
      typecheck, unit-test, and protocol modules.
- [ ] Add `@cursor/sdk` through the workspace lockfile; run license generation
      and confirm all newly shipped dependencies meet repository policy.
- [ ] Launch the compiled worker with Electron `utilityProcess.fork()` from a
      small main-process harness.
- [ ] Implement versioned request/response/event validation and graceful
      startup/shutdown.
- [ ] Implement auth login/status/logout without forwarding keys to the parent
      or renderer.
- [ ] Put both the dedicated auth store and bounded JSONL agent store below the
      isolated app profile; verify no fallback writes to the repository or shared
      default SDK auth location.
- [ ] List the current account's models and parameters dynamically.
- [ ] Stream a text-only prompt, cancel it, and normalize terminal errors.
- [ ] Register one harmless `echo_probe` custom tool that round-trips through
      parent IPC.
- [ ] Configure `tools: ["mcp"]`, no `mcpServers`, and no
      `local.settingSources`; prove the probe works while shell, read/write/edit,
      web, task/subagents, and ambient MCP servers do not.
- [ ] Prove `tools: []` disables the positive custom-tool probe as expected and
      reapply `tools: ["mcp"]` on every resume.
- [ ] Enable the SDK sandbox and confirm startup fails clearly if the matching
      native platform helper is unavailable.
- [ ] Use a bounded JSONL store under a temporary isolated profile and verify
      disposal/restart behavior.

Tests and evidence:

- protocol unit tests for invalid version/type/ID, timeout, duplicate terminal,
  cancellation, late tool result, and worker exit;
- mocked SDK tests for deterministic CI;
- an opt-in local smoke script that performs real Cursor login/model/run/tool
  calls without printing credentials;
- a short compatibility note recording the tested SDK, Electron, Node, macOS,
  and architecture versions.

Exit gate: the isolated probe works locally, prohibited capabilities are
demonstrably unavailable, a worker crash does not crash Electron main, and no
Slides source depends on the spike yet. If custom tools cannot be isolated,
stop and revise ADR 0002 before proceeding.

Suggested commit slices:

1. `add cursor worker protocol`
2. `add cursor sdk utility process spike`
3. `test cursor worker isolation`

## Phase 2: read-only Slides backend

Goal: authenticate from the Slides panel and let Cursor understand exactly one
active deck without mutation.

Planned work:

- [ ] Define Cursor renderer IPC types in
      `apps/slides/src/shared/cursor-ipc.ts`; expose only those calls/events in
      preload.
- [ ] Add the worker client and run controller under
      `apps/slides/src/main/cursor/`.
- [ ] Introduce an explicit agent-backend selector in the Slides AI UI; retain
      the existing Genspark path as a separate optional backend.
- [ ] Add Cursor login, logout, status, model/variant selection, run streaming,
      cancellation, and failure UI using semantic theme tokens and i18n.
- [ ] Show a first-run disclosure for Cursor-hosted inference and the bounded
      deck context/tool results sent during a run.
- [ ] Pin every run to the initiating renderer/session with an opaque
      capability and invalidate it on session replacement or renderer destruction.
- [ ] Extract bounded pure deck-outline and slide-inspection functions from the
      current renderer skill into a main/shared read service.
- [ ] Implement and test `get_deck_context` and `read_slide` custom tools.
- [ ] Ensure all run cleanup paths release timers, listeners, pending tool
      promises, and worker resources.

Exit gate: from a blank or opened deck, Cursor accurately answers bounded
questions about the deck; switching/closing the deck makes the run stale; no
mutation and no Genspark call occurs.

Suggested commit slices:

1. `add cursor slides ipc contracts`
2. `add cursor backend controls to slides`
3. `add read-only cursor deck tools`

## Phase 3: first undoable edit

Goal: make one Cursor text edit follow the same mutation and history semantics
as manual editing.

Planned work:

- [ ] Extract the text-edit command from its IPC handler into a service that
      receives an explicit `Session`.
- [ ] Keep the existing renderer IPC handler as a thin adapter to that service.
- [ ] Add main-side `set_element_text` schema validation, limits, error codes,
      stale-ID handling, and fresh render response.
- [ ] Begin one history batch at run start and end/settle it exactly once on
      success, error, cancel, worker exit, renderer close, and session replacement.
- [ ] Notify only the initiating renderer of fresh slide state and history
      availability.
- [ ] Register an AI rollback snapshot when a run made real edits.
- [ ] Add concurrency protection so a second mutating run for the same deck is
      rejected or explicitly cancels the first.

Exit gate: A-04 through A-07 pass; one run is one undo step; manual edit and
existing Genspark tool tests still pass.

Suggested commit slices:

1. `extract slides text command service`
2. `add cursor text edit tool`
3. `test cursor run history cleanup`

## Phase 4: composed native slide

Goal: generate one simple, visually clear, editable slide per run from the
closed MVP catalog, without a Genspark generation endpoint. See ADR 0003.

Planned work:

- [ ] Extract shared services for element insertion, native tables, native bar
      charts, and SmartArt-style diagrams while preserving existing IPC
      behavior. Cursor must not register `add_table` or `add_chart` as custom
      tools.
- [ ] Add `compose-command-service.ts` that lands `title_kicker`,
      `input_cycle_outputs`, `insight_table`, and `bar_comparison` from
      structured specs. GenOffice owns geometry, grouping, and palette.
- [ ] Implement `compose_slide` as the from-scratch creation tool, with
      `add_text_box`, `add_shape`, and `add_diagram` limited to bounded tweaks
      and strict geometry, color, text, preset, node-count, and per-run call
      limits.
- [ ] Gate `insight_table` and `bar_comparison` so every numeric cell or series
      value appears in the initiating user prompt; reject sample or invented
      figures before mutation.
- [ ] Provide the worker a compact Slides-specific system instruction that
      names the four layout ids and content fields, requires inspecting tool
      results, and does not teach free canvas coordinates for whole-slide
      creation.
- [ ] Add deterministic layout checks for missing regions, out-of-bounds
      elements, unsupported shape geometry, empty required text, oversized
      tables/charts, and excessive overlap.
- [ ] Send fresh rendered state after every accepted operation without changing
      the run's pinned deck.
- [ ] Add non-Genspark prompt/evaluation fixtures for each layout id, including
      a missing-figure rejection case.
- [ ] Save As, reopen, inspect native editability, and compare rendered output
      according to `TEST_PLAN.md`.

Exit gate: A-02, A-03, A-03b, A-03c, A-03d, A-03e, A-05, A-08, and A-10 pass
on a blank deck. Each accepted layout is native, in-canvas, and editable, and
uses no HTML/cloud slide-generation path. The tool-name sequence includes
`compose_slide`.

Suggested commit slices:

1. `extract slides insertion table and chart services`
2. `add cursor compose slide templates`
3. `test cursor compose figure gate and pptx round trip`

## Phase 5: trusted skill

Goal: reuse one familiar slide-generation skill without importing the Cursor
Editor's broad ambient capabilities.

Planned work:

- [ ] Implement managed skill discovery below the isolated GenOffice Cursor
      profile; do not use SDK workspace scanning or silently load any
      user/team/plugin/project setting.
- [ ] Show skill source, instructions, compatibility, and enabled state before
      a run.
- [ ] Define a minimal compatibility record: contained `SKILL.md`, supported
      text assets, expected tools, version/hash, and adaptation notes; reject
      symlink escapes and bounded-size violations.
- [ ] Copy only approved instructions/supported text assets into the managed
      catalog and inject their bounded text as a labeled system-instruction
      section. Keep `local.settingSources` omitted.
- [ ] Ignore `.cursor` configuration, MCP definitions, hooks, agent
      definitions, executables, scripts, and undeclared files in a skill
      package.
- [ ] Prove a skill cannot add built-in tools, ambient MCP servers, network
      access, or subagents.
- [ ] Adapt one actual slide-generation skill to the four MVP layout ids and
      bounded edits; document any unsupported behavior. The skill must remain
      instruction-only and must not invent figures.
- [ ] Keep the managed skill catalog, enabled state, and SDK state outside Git.

Exit gate: A-09 and A-10 pass, and disabling the skill returns to the base
Slides behavior without changing the tool surface.

Suggested commit slices:

1. `add managed cursor skill catalog`
2. `adapt first slides skill`
3. `test cursor skill capability isolation`

## Phase 6: MVP hardening

Goal: make the full unpackaged MVP safe and repeatable.

Planned work:

- [ ] Add budgets for prompt/context size, tool calls, output size, run time,
      stored events, and worker restarts.
- [ ] Redact secrets, file paths, prompts, and document content from default
      logs while preserving run/operation diagnostics.
- [ ] Cover auth expiry, unavailable saved model, offline inference, malformed
      worker messages, tool timeout, worker crash, and application shutdown.
- [ ] Run every acceptance scenario with Genspark logged out.
- [ ] Run focused and repository quality checks in `TEST_PLAN.md`.
- [ ] Merge a current `upstream/main` snapshot into `cursor`, resolve conflicts
      only on `cursor`, and rerun the acceptance path.
- [ ] Perform an independent code/security review of the entire Cursor diff.
- [ ] Update this plan, architecture, and ADRs to match the final code.

Exit gate: the Slides MVP definition of done passes and the remaining risks are
documented as post-MVP work rather than hidden test gaps.

## Phase 7: personal packaged beta

Goal: install the personal fork beside the official app on both Macs.

This phase begins only after Phase 6.

- [ ] Implement `GenOffice Cursor` product name, bundle ID, and an early,
      explicit packaged user-data path per ADR 0001.
- [ ] Include the compiled worker, SDK runtime dependencies, and the matching
      native platform package outside `app.asar`.
- [ ] Make packaging fail if a required worker/platform resource is missing.
- [ ] Keep `GENOFFICE_UPDATE_URL` unset and verify no official update config is
      packaged.
- [ ] Verify app coexistence, separate profiles/locks, file association choice,
      Cursor login, sandbox, run, save, and reopen on each Mac/architecture.
- [ ] Build or copy only a private artifact; no public release or updater work.

Exit gate: both apps run independently, the personal build passes every
acceptance scenario, and removing it does not affect official GenOffice or its
data.

## Post-MVP horizon

Do not start this work before Phase 6. Scope lives in [PRODUCT.md](PRODUCT.md);
this list is only dependency order after the composed-slide MVP:

- [ ] `plan_deck` returns titles, roles, and layout ids with no coordinates.
- [ ] A main-owned loop lands accepted specs through `compose_slide`, first
      for 8–12 pages, then toward about 30, with windowed deck reads.
- [ ] Cancellation keeps landed pages; missing pages keep stable indices.
- [ ] Sequential review and outline-assist runs reuse the same allowlist. Do
      not enable SDK `agents` or `"task"`.
- [ ] Optional compose concurrency, if added, is deterministic template
      landing, not model-parallel writers on one session.

## Risk register and decision gates

<!-- markdownlint-disable MD013 -->

| Risk                                                             | Earliest proof | Stop condition                                                                                          |
| ---------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| SDK custom tools cannot be isolated from built-in/ambient tools  | Phase 1        | Do not connect the SDK to a document; revise the worker policy                                          |
| SDK lazy chunks/native helper fail in Electron utility process   | Phase 1        | Choose an unbundled child-process host or revise packaging ADR                                          |
| Existing renderer tool logic cannot be shared safely             | Phase 2-3      | Extract main command services before adding more tools                                                  |
| Worker events can target a different deck after tab changes      | Phase 2        | Do not enable mutation until pinned-session tests pass                                                  |
| One-run history batching breaks on cancellation/crash            | Phase 3        | Do not add creation tools until all terminal paths pass                                                 |
| Native compose template is unreadable or not editable            | Phase 4        | Improve the template service; do not fall back to Genspark, primitives, or subagents                    |
| Table/chart compose fails round-trip or the figure gate misfires | Phase 4        | Fix native insert and prompt normalization; do not add sample figures or Cursor `add_table`/`add_chart` |
| Existing personal skill needs unavailable IDE tools              | Phase 5        | Adapt it explicitly or mark it incompatible; do not grant new capabilities                              |
| Upstream merges create recurring conflicts in giant handlers     | Every sync     | Continue extracting thin adapters; keep Cursor files additive                                           |

<!-- markdownlint-enable MD013 -->
