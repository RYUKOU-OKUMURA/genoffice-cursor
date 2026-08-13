---
status: active
last-reviewed: 2026-08-13
---

# GenOffice Cursor documentation

This directory is the source of truth for the personal Cursor integration.
The first delivery target is a Genspark-independent Slides MVP: a user signs
in with a Cursor account, gives natural-language instructions, and creates or
edits a native PPTX through GenOffice's existing presentation engine.

## Read this first

Read the documents in this order when starting implementation work:

1. [Product direction](PRODUCT.md)
2. [Slides MVP requirements](SLIDES_MVP_REQUIREMENTS.md)
3. [Target architecture](ARCHITECTURE.md)
4. [Implementation plan](IMPLEMENTATION_PLAN.md)
5. [Test plan](TEST_PLAN.md)

Read [Development and operations](OPERATIONS.md) when setting up another Mac,
running the fork, syncing upstream, or preparing a personal package.

Use [Reference catalog](REFERENCE_CATALOG.md) to decide which upstream files
apply to the task at hand. Upstream documentation is not one undifferentiated
reference set: licensing, security, contribution rules, and existing tests are
binding constraints, while product descriptions and unrelated app documents
are background material.

## Authority and conflict order

Use this order when two documents disagree:

1. Applicable licenses and security requirements
2. Applicable repository instructions, including root and nested `AGENTS.md`,
   `CONTRIBUTING.md`, and task-relevant `CLAUDE.md` rules
3. Accepted architecture decisions in `docs/adr/`
4. The owning document in this `docs/cursor/` set
5. Existing compatibility/fidelity tests and current implementation behavior
6. Upstream product documentation and historical design notes

Current code can legitimately lag a target requirement or plan. A conflict
that is not merely unimplemented target behavior indicates documentation or
test drift: update the owning source in the same change, or record a deliberate
decision in an ADR.

## Document ownership

<!-- markdownlint-disable MD013 -->

| Document                     | Owns                                                     | Does not own                  |
| ---------------------------- | -------------------------------------------------------- | ----------------------------- |
| `PRODUCT.md`                 | Product outcome, scope, and Genspark independence        | Technical task order          |
| `SLIDES_MVP_REQUIREMENTS.md` | User-visible behavior and acceptance criteria            | Process/package layout        |
| `ARCHITECTURE.md`            | Component boundaries, trust boundaries, and tool flow    | Schedule or completion status |
| `IMPLEMENTATION_PLAN.md`     | Ordered work packages, dependencies, and exit gates      | Product rationale             |
| `TEST_PLAN.md`               | Verification matrix and release evidence                 | Implementation design         |
| `OPERATIONS.md`              | Local setup, two-Mac use, upstream sync, app coexistence | Product or agent architecture |
| `REFERENCE_CATALOG.md`       | What to read for each kind of change                     | New product requirements      |
| `docs/adr/*`                 | Accepted, durable design decisions                       | Mutable task checklists       |

<!-- markdownlint-enable MD013 -->

## Current decisions

- The MVP is Slides only; Sheets and Docs are explicitly deferred.
- Cursor is a separate agent backend, not another raw model provider inside
  `@genoffice/ai-provider`.
- GenOffice remains authoritative for deck state, rendering, undo/redo, and
  PPTX import/export.
- The SDK runs locally in an isolated utility process and receives only
  allowlisted custom tools. See [ADR 0002](../adr/0002-isolate-cursor-sdk-worker.md).
- From-scratch creation uses `compose_slide` templates, not model-placed
  primitives, Genspark HTML, or SDK subagents. See
  [ADR 0003](../adr/0003-quality-first-native-slide-composition.md).
- The MVP lands one `input_cycle_outputs` slide. About 30 native pages is a
  post-MVP horizon in [PRODUCT.md](PRODUCT.md), not an MVP acceptance target.
- Skills are explicitly selected, instruction-only, and cannot expand tools.
- Existing Genspark behavior may remain available for upstream compatibility,
  but the Cursor acceptance path must not require or invoke it.
- A packaged personal build must use the separate app identity in
  [ADR 0001](../adr/0001-separate-personal-app-identity.md).

## Repository and branch convention

- Local checkout:
  `/Users/ryukouokumura/Desktop/boss-workspace/genoffice-cursor`
- `origin`: `RYUKOU-OKUMURA/genoffice-cursor`
- `upstream`: fetch-only `genspark-ai/genoffice`
- `main`: clean fast-forward mirror of `upstream/main`
- `cursor`: persistent personal product branch
- `feature/*`: focused implementation branches from `cursor`

Never commit personal changes to `main`, and never push to `upstream`.
