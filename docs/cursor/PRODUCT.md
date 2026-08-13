---
status: active
last-reviewed: 2026-08-13
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
4. Ask in natural language for a slide or a bounded edit.
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
Cursor work begins in Sheets or Docs. The first diagram can be built from
native shapes or existing SmartArt composition; photorealistic image
generation is not part of the MVP.

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
- Adding text, native shapes, and one supported native diagram layout
- One run collapsing to one normal undo step
- Saving and reopening a native PPTX
- Loading one explicitly selected and compatible slide skill
- Cancellation, bounded errors, and safe behavior when the active deck changes

Out of scope:

- Sheets, Docs, PDF, and Markdown Cursor tools
- Genspark replacement for web search, image search, or media generation
- Arbitrary shell, code-edit, filesystem, MCP, or subagent capabilities
- Cloud-agent mode for document editing
- Background autonomous editing or multi-document batch operations
- Public binaries, public updates, team administration, or billing UI
- Pixel-perfect arbitrary deck generation across every presentation genre

## Success measures

The MVP is successful when all acceptance scenarios in
`SLIDES_MVP_REQUIREMENTS.md` pass on an isolated development profile and a
real PPTX survives the defined round-trip checks. The follow-on daily-use beta
is successful only after the separately identified `GenOffice Cursor.app`
runs alongside the official `GenOffice.app` on both development Macs.
