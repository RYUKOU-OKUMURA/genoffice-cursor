---
status: accepted
---

# Quality-first native slide composition

Cursor slide creation uses GenOffice layout templates, not model-placed
primitives, Genspark cloud generation, or SDK subagents. The MVP proves one
visually clear composed slide. Later multi-slide work reuses that compose path
inside a main-owned landing loop, aiming at about 30 native pages without
widening worker privileges.

## Context

The Cursor backend is a separate agent runtime with a fail-closed tool
allowlist. The first useful slide is a simple but visually clear composition
(title and subtitle, left-to-right input, a cyclic process, and stacked
outputs), not a title plus an isolated three-node diagram.

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
- **One layout family in the MVP.** The first template is `input_cycle_outputs`:
  a header band, an input region, a four-step cycle, and stacked outputs.
  Matching a specific screenshot pixel-for-pixel is not required; readable
  hierarchy, a consistent palette, in-canvas native groups, and PPTX round-trip
  are required.
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
  count must be system-guaranteed, and lets the MVP spend its budget on one
  readable native slide.

## Consequences

- Phase 4 implements `compose_slide` and the `input_cycle_outputs` template
  before any multi-slide planner.
- Worker system instructions describe layout ids and content fields, not a
  free canvas coordinate language, for from-scratch creation.
- Adding `add_slide` without compose, raising primitive call budgets to cover
  20–30 pages, or passing `agents` / `"task"` requires a new ADR.
- Post-MVP review and outline-assist runs must keep the same tool allowlist
  and must not overlap a mutating generate run on the same session.
- Visual reproducibility is owned by templates; skill text is not a substitute
  for a missing layout family.
