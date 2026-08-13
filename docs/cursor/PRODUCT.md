---
status: active
last-reviewed: 2026-08-14
---

# Product direction

## Outcome

GenOffice Cursor is a personal desktop Office workspace that can create and
edit native Office documents through a Cursor subscription. The immediate
outcome is a useful Slides workflow that keeps working after the user stops
paying for Genspark.

The target experience is:

1. Open GenOffice Cursor and start a blank presentation or open a PPTX.
2. Sign in to Cursor inside the app.
3. Select a model exposed to that Cursor account.
4. Ask in natural language for a slide or a bounded edit. From-scratch
   creation should yield one simple but visually clear native slide, not a
   pile of ungrouped boxes.
5. Optionally apply an explicitly trusted slide-generation skill.
6. Inspect, undo, save, and reopen the result as a normal PPTX.

Cursor provides the hosted model and agent runtime. GenOffice provides the
document model, native editing operations, visual rendering, history, and
OOXML persistence. The Cursor SDK is not treated as a PowerPoint file API.
AI execution is not offline: prompts and the bounded deck context/tool results
needed for a run are sent to Cursor's hosted model under the user's Cursor
account and Privacy Mode settings. The app must disclose this before the first
run and minimize the content it sends.

## Product principles

### Cursor account is sufficient

The primary acceptance path runs while Genspark is logged out, with no GSK API
key and no call to `@genspark/cli` or a Genspark slide-generation endpoint.
Existing upstream Genspark features may remain as an optional compatibility
path, but they are not a dependency of the Cursor MVP.

SDK usage follows Cursor account availability, pricing, model access, and
Privacy Mode. The app must discover the account's model catalog at runtime.
Names such as Grok are user choices only when the current catalog exposes
them; no model ID is hard-coded as a permanent guarantee.

### Native and reversible edits

Agent actions use narrow GenOffice commands. They participate in the same
history, rendering, dirty-state, and save behavior as manual actions. A model
never writes a PPTX archive directly and never receives unrestricted access to
the user's filesystem.

### Useful vertical slice before breadth

Slides must pass creation, editing, undo, and PPTX round-trip acceptance before
Cursor work begins in Sheets or Docs. The MVP creates one composed slide per
run from a closed layout catalog, not an arbitrary deck and not a bitmap.
Photorealistic image generation is not part of the MVP.

### Quality over parallel generation

Readable native slides beat faster, inconsistent ones. The model chooses
content and a layout id; GenOffice templates place grouped shapes. Skills may
stabilize tone and structure, but they cannot add tools or own coordinates.
SDK subagents stay disabled even for review or outline assist: those jobs are
later sequential runs. See [ADR 0003](../adr/0003-quality-first-native-slide-composition.md).

### Personal operation, upstream-friendly maintenance

The fork is for the owner's two Macs and is not publicly distributed. Custom
code stays on `cursor` and behind thin integration boundaries so current
GenOffice updates can continue to merge from `upstream/main`.

## MVP scope

In scope:

- Cursor browser login, status, logout, and account-aware model selection
- A clear hosted-model/data-use notice before the first run
- Streaming one agent run at a time for the active Slides document
- Reading deck structure and an individual slide
- Editing text through the normal Slides command path
- Composing one slide per run from the closed MVP catalog:
  `title_kicker`, `input_cycle_outputs`, `insight_table`, and `bar_comparison`
- Native tables and bar charts only inside those compose templates, using the
  existing Slides table/chart commands
- Numeric table cells and chart values taken only from the initiating user
  prompt; invented or sample figures are rejected
- Bounded text/shape/diagram edits on an existing slide
- One run collapsing to one normal undo step
- Saving and reopening a native PPTX
- Loading one explicitly selected and compatible slide skill
- Cancellation, bounded errors, and safe behavior when the active deck changes

Out of scope:

- Sheets, Docs, PDF, and Markdown Cursor tools
- Genspark replacement for web search, image search, or media generation
- Arbitrary shell, code-edit, filesystem, MCP, or subagent capabilities,
  including Cursor SDK `task` / `agents` even for review or outline assist
- Cloud-agent mode for document editing
- Model-parallel mutation of the same deck
- Multi-slide deck generation as an MVP acceptance target
- Line, pie, combo, or other non-bar chart types
- Sample, illustrative, or model-invented figures presented as data
- Exposing `add_table` or `add_chart` as Cursor custom tools
- Background autonomous editing or multi-document batch operations
- Public binaries, public updates, team administration, or billing UI
- Pixel-perfect matching of a screenshot, or arbitrary-genre deck generation

## Product horizon

These outcomes are intended after the Slides MVP, using the same compose path
and the same worker allowlist. They are not MVP acceptance:

1. **Short native decks.** An accepted outline lands as 8–12 native slides
   through a main-owned loop. Cancellation keeps already landed pages.
2. **Large native decks.** The same loop should complete about 30 pages with
   windowed deck reads, stable indices for missing pages, and one consistent
   template theme. Thirty pages of unsupported genres is out of scope.
3. **Specialist runs.** Review (read, flag, do not silently rewrite) and
   outline assist (propose structure, land only after acceptance) are separate
   sequential runs after generation, not nested SDK agents.

Multi-slide work starts only after the MVP composed slide, undo, and PPTX
round-trip pass. Adding `add_slide` without compose, or raising primitive call
budgets to fake a 30-page generator, is not that work.

## Success measures

The MVP is successful when all acceptance scenarios in
`SLIDES_MVP_REQUIREMENTS.md` pass on an isolated development profile and a
real PPTX survives the defined round-trip checks. Horizon deck generation is
not part of that bar.

The follow-on daily-use beta is successful only after the separately identified
`GenOffice Cursor.app` runs alongside the official `GenOffice.app` on both
development Macs.
