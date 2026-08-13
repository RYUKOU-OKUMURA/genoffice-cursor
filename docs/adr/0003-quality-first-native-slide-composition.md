---
status: accepted
---

# Quality-first native slide composition

Cursor slide creation uses GenOffice layout templates, not model-placed
primitives, Genspark cloud generation, or SDK subagents. The MVP proves four
visually clear composed layouts, one slide per run. Later multi-slide work
reuses that compose path inside a main-owned landing loop, aiming at about 30
native pages without widening worker privileges.

## Context

The Cursor backend is a separate agent runtime with a fail-closed tool
allowlist. The quality floor is a small closed catalog: a title, a cyclic
process infographic, an analyst comparison with a native table, and a native
bar chart. Matching a screenshot pixel-for-pixel is not required. A six-slide
deck in one run is a later horizon, not the MVP.

The [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript) can spawn
named subagents through the `task` / `Agent` tool, load `.cursor/agents/*.md`,
and inherit [custom tools](https://cursor.com/docs/sdk/typescript#custom-tools)
into those children. Parallel page generation looks attractive for a 20–30
page deck. It also creates concurrent writers on one session, inconsistent
themes, fragile undo/cancel, and a privilege expansion: once the parent can
mutate a deck, children can too.

Upstream `generate_deck` already refuses to let the model hand-place dozens of
pages. It plans internally and lands pages in a system loop. That loop depends
on Genspark HTML generation, which the Cursor acceptance path must not call.

## Decision

- **Compose, then tweak.** From-scratch creation calls `compose_slide` with a
  structured spec and a supported layout id. GenOffice owns geometry, grouping,
  and palette. `set_element_text`, `add_text_box`, `add_shape`, and
  `add_diagram` remain for bounded edits after a slide exists.
- **Closed MVP catalog, one slide per run.** Supported layout ids are
  `title_kicker`, `input_cycle_outputs`, `insight_table`, and
  `bar_comparison`. Tables and bar charts are inserted only inside those
  templates through existing Slides commands. Do not register `add_table` or
  `add_chart` as Cursor custom tools. Line, pie, and combo charts are out of
  scope. Readable hierarchy, a consistent palette, in-canvas native groups,
  and PPTX round-trip are required.
- **User-provided figures only.** Numeric table cells and bar-chart values
  must appear in the initiating user prompt after light normalization
  (currency marks, commas, whitespace). Sample, illustrative, or
  model-invented figures fail before mutation. `title_kicker` and
  `input_cycle_outputs` do not take numeric series.
- **Skills stay instruction-only.** An explicitly enabled skill may stabilize
  tone, outline shape, and which layout to choose. It must not add tools, MCP,
  filesystem, network, or subagent capability, and it must not own coordinates.
- **No SDK subagents.** Omit `agents`, omit `"task"` from `tools`, and keep
  `tools: ["mcp"]` with the private Slides custom-tool map. Review and outline
  assist, when added, are later sequential runs with the same allowlist, not
  nested agents during generation.
- **No model-parallel mutation.** Speed for a large deck comes from landing
  already-accepted specs in a main-owned loop. Optional later concurrency is
  deterministic compose, not several LLMs writing the same deck.
- **Horizon, not MVP.** About 30 native pages is the intended later capacity
  of that loop, with windowed deck reads, cancellation that keeps landed
  pages, and fill-in of missing indices. It is not an MVP acceptance scenario.

Product scope and non-goals live in [`docs/cursor/PRODUCT.md`](../cursor/PRODUCT.md).
MVP behavior lives in
[`docs/cursor/SLIDES_MVP_REQUIREMENTS.md`](../cursor/SLIDES_MVP_REQUIREMENTS.md).

## Considered options

- **Let the model assemble the slide from primitives** was rejected because
  the reference visual bar needs nested regions and a cycle. Primitive spam
  also cannot scale to tens of pages without truncation and layout drift.
- **Call existing `generate_deck` / `regenerate_slide`** was rejected because
  those tools require Genspark cloud HTML generation.
- **Enable SDK subagents for parallel pages** was rejected because custom
  tools reach children, session pinning and one-run history cannot stay
  authoritative, and faster poor pages increase rework.
- **Enable SDK subagents only for review or outline assist** was rejected
  because that still opens `"task"` and still leaks mutate tools. Those jobs
  are sequential specialist runs after generation, plus deterministic layout
  checks in main.
- **Compose templates plus a later plan-and-land loop** was selected because
  it keeps the worker allowlist small, matches the Genspark lesson that page
  count must be system-guaranteed, and lets the MVP spend its budget on a
  closed catalog of readable native slides rather than a whole-deck generator.
- **A six-slide deck as the MVP** was rejected; the same layouts can later
  land in a short-deck loop after one-slide compose is proven.
- **Exposing `add_table` / `add_chart` to the model** was rejected because
  that returns to primitive assembly. Templates call those commands
  internally.
- **Sample or illustrative figures** were rejected for the MVP; comparison
  and chart layouts require numbers from the user prompt.

## Consequences

- Phase 4 implements `compose_slide` for all four MVP layout ids, including
  internal table and bar-chart insertion and the prompt figure gate, before
  any multi-slide planner.
- Worker system instructions describe layout ids and content fields, not a
  free canvas coordinate language, for from-scratch creation.
- Adding `add_slide` without compose, raising primitive call budgets to cover
  20–30 pages, passing `agents` / `"task"`, or adding `add_table` / `add_chart`
  to the Cursor allowlist requires a new ADR.
- Post-MVP review and outline-assist runs must keep the same tool allowlist
  and must not overlap a mutating generate run on the same session.
- Visual reproducibility is owned by templates; skill text is not a substitute
  for a missing layout family.
