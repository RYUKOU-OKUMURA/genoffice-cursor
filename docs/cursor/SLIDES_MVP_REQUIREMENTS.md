---
status: active
last-reviewed: 2026-08-14
---

# Slides MVP requirements

## Definitions

- **Cursor backend**: the local Cursor SDK agent runtime plus the GenOffice
  worker and bridge. Model inference remains hosted by Cursor.
- **Active deck**: the Slides main-process session bound to the renderer that
  started the run. It is not inferred again from the currently focused window.
- **Trusted skill**: a user-selected skill whose instructions are available to
  the worker and whose declared requirements fit the GenOffice tool allowlist.
  Skills change instructions only; they do not own layout geometry.
- **Run**: one natural-language request and all tool calls it triggers until it
  completes, fails, or is cancelled.
- **Composed slide**: one native slide produced by `compose_slide` from a
  structured spec and a supported layout id. The closed MVP catalog is
  `title_kicker`, `input_cycle_outputs`, `insight_table`, and `bar_comparison`.
  Multi-slide generation, review runs, and outline-assist runs are product
  horizon work in [PRODUCT.md](PRODUCT.md), not scenarios in this file.
- **User-provided figure**: a numeric token that appears in the initiating user
  prompt after normalizing currency marks, commas, and surrounding whitespace.
  Table cells and chart values may use only these tokens.

## Preconditions

- Node.js 22.13 or newer is available to the SDK worker.
- Development uses an isolated profile:

  ```bash
  GENOFFICE_USER_DATA="$PWD/.task/user-data" npm run dev
  ```

- The official installed `GenOffice.app` is not modified.
- Tests use copied or generated PPTX fixtures, never the only copy of a user
  document.

## Functional requirements

### Authentication and model selection

- **FR-001** The app can start Cursor's browser login and display logged-in,
  logged-out, expired, and error states without exposing a credential to the
  renderer.
- **FR-002** Logout removes the worker's stored Cursor credential so subsequent
  SDK calls for this integration are logged out. It does not claim to revoke a
  minted key outside the SDK's documented logout behavior.
- **FR-003** The UI lists models and valid variants returned for the current
  account. A saved model that disappears falls back visibly rather than
  failing silently.
- **FR-004** No Genspark login or key is required for any acceptance scenario.
- **FR-005** Before the first run, the UI explains that model inference is
  hosted by Cursor and that the prompt plus bounded deck context/tool results
  needed by the run are sent to Cursor under the account's Privacy Mode.

### Agent session

- **FR-010** A user can submit a prompt, observe streamed progress, cancel the
  run, and receive a terminal success, cancelled, or error state.
- **FR-011** Only one mutating run may own a deck session at a time.
- **FR-012** Every run is pinned to the initiating deck session. Closing,
  replacing, or switching that session prevents further tool mutations.
- **FR-013** The worker receives an opaque run/session capability, not the deck
  path or general renderer IPC access.

### Read, compose, and edit tools

- **FR-020** `get_deck_context` returns bounded deck metadata and an outline of
  slide text/elements.
- **FR-021** `read_slide` returns bounded details for one valid slide index.
- **FR-022** `set_element_text` replaces one valid text element using the
  existing Slides edit pipeline.
- **FR-023** `add_text_box` and `add_shape` create bounded native elements on an
  existing slide. They are for tweaks, not from-scratch whole-slide assembly.
- **FR-024** `add_diagram` creates one supported native diagram layout with
  bounded node text and node count. It may be used inside compose or as a later
  bounded edit; it is not the from-scratch creation path.
- **FR-025** Invalid indices, stale element IDs, NaN/infinite geometry, invalid
  colors, unsupported shape names, unsupported compose layouts, oversized text,
  and excessive calls fail before mutation.
- **FR-026** Every successful mutating tool returns fresh affected-slide state
  and stable, user-readable feedback to the renderer.
- **FR-027** `compose_slide` creates one slide from a supported layout id.
  GenOffice owns geometry, grouping, palette, and (for `insight_table` /
  `bar_comparison`) native table or bar-chart insertion. The model does not
  supply canvas coordinates or call `add_table` / `add_chart` directly.
  Layouts:
  - `title_kicker`: kicker plus title
  - `input_cycle_outputs`: title/subtitle, input, four-step cycle, stacked
    outputs
  - `insight_table`: kicker, title, optional chevron timeline as shapes,
    prose, comparison table (max 6×5 including header), So-what callout,
    footnotes
  - `bar_comparison`: title, one native bar chart (max 8 categories, 3
    series), short takeaway
- **FR-028** For `insight_table` and `bar_comparison`, every numeric table cell
  and chart value must be a user-provided figure from the initiating prompt.
  Missing figures, sample/illustrative placeholders, or numbers that do not
  match the prompt fail before mutation.

### History and persistence

- **FR-030** All mutations from one successful or partially successful run
  collapse into one existing Slides undo step.
- **FR-031** Failure or cancellation closes the history batch; it never leaves
  undo/redo permanently blocked.
- **FR-032** Undo and redo update the rendered slide and history controls.
- **FR-033** A user can save through the existing Slides save flow and reopen
  the PPTX with generated text, composed groups, and native tables or bar
  charts intact.
- **FR-034** Content not touched by the run retains the existing PPTX
  round-trip guarantees.

### Skill use

- **FR-040** The user can inspect and explicitly enable one compatible slide
  skill for a run.
- **FR-041** Enabling a skill changes instructions only; it cannot expand the
  run's tool, filesystem, network, MCP, or subagent capabilities.
- **FR-042** A skill that requires unavailable IDE tools or external assets is
  reported as incompatible or adapted before execution.
- **FR-043** Skills and their enabled state are local to the personal app
  profile and are not committed automatically.

## Non-functional requirements

- **NFR-001 Security** The SDK runs in local mode with the sandbox enabled and
  a fail-closed tool allowlist. No built-in shell, edit, write, general file,
  web, task/subagent, or ambient MCP tool is available. The worker must not
  pass `agents` or include `"task"` in `tools`, including for review or
  outline-assist runs.
- **NFR-002 Validation** Electron main validates every model-produced argument
  again even if the worker already validated it.
- **NFR-003 Secrets** Cursor credentials never enter Git, renderer state,
  analytics, prompt context, or normal logs.
- **NFR-004 Limits** Tool payloads, returned deck context, call counts, run
  duration, and stored event history are bounded.
- **NFR-005 Isolation** A worker crash affects the agent run, not the Slides
  document process. The user can continue manual editing and restart the
  backend.
- **NFR-006 Maintenance** Cursor-specific changes are isolated so upstream
  Slides engine updates can merge without rewriting the integration.
- **NFR-007 Fidelity** Agent-created content is native and editable in both
  GenOffice and PowerPoint-compatible applications after save.
- **NFR-008 Observability** Logs use run IDs and operation names but redact
  credentials, full prompts by default, file paths, and document contents.
- **NFR-009 Data minimization** The worker sends only the bounded slide context
  needed for the current request; it does not upload raw PPTX bytes, unrelated
  slides, user-data directories, or arbitrary files.

## Acceptance scenarios

<!-- markdownlint-disable MD013 -->

| ID    | Scenario                                                                        | Expected result                                                                              |
| ----- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| A-01  | Log in to Cursor from a clean isolated profile                                  | Browser flow completes; account and available models appear; no key reaches the renderer     |
| A-01b | Start the first run from a clean isolated profile                               | Hosted-model/data-use notice appears before deck context is sent                             |
| A-02  | Run with Genspark logged out and GSK variables unset                            | All remaining scenarios work; no Genspark CLI or slide endpoint is called                    |
| A-03  | Open a blank presentation and ask for one simple, visually clear workflow slide | `compose_slide` lands `input_cycle_outputs`: title/subtitle, input, four-step cycle, stacked outputs; native grouped shapes; in-canvas; no HTML/bitmap page |
| A-03b | Ask for a title slide with a kicker                                             | `compose_slide` lands `title_kicker`                                                                 |
| A-03c | Ask for a comparison slide and include the table numbers in the prompt          | `compose_slide` lands `insight_table` with a native table; every numeric cell matches the prompt     |
| A-03d | Ask for a bar-chart slide and include the category values in the prompt         | `compose_slide` lands `bar_comparison` with one native bar chart; series values match the prompt     |
| A-03e | Repeat A-03c or A-03d without supplying figures                                 | The tool is rejected; the deck is unchanged                                                          |
| A-04  | Ask to revise the title                                                         | The existing text element changes through `set_element_text`                                 |
| A-05  | Undo after a compose or text-edit run                                           | The entire run reverses as one undo step; redo restores it                                   |
| A-06  | Cancel midway through a multi-tool run                                          | No further tool is accepted; history remains usable; completed edits are one undoable batch  |
| A-07  | Switch or close the deck while a run is active                                  | Subsequent tool calls fail as stale and do not touch another deck                            |
| A-08  | Save As, close, and reopen the generated PPTX                                   | Title, composed regions, native table/chart where used, and editable elements survive        |
| A-09  | Enable one trusted slide-generation skill and repeat A-03                       | The skill influences the result but receives only the same GenOffice tool allowlist          |
| A-10  | Supply prompt-injection text asking for shell or arbitrary file access          | The capability is unavailable and no external file or command is touched                     |
| A-11  | Kill the worker during a run                                                    | The UI reports failure, the document remains editable, and a new run can start after restart |

<!-- markdownlint-enable MD013 -->

## Definition of done

The Slides MVP is done only when:

- Every acceptance scenario above has evidence recorded according to
  `TEST_PLAN.md`.
- Focused unit and integration tests pass.
- Repository format, lint, typecheck, license, and relevant test checks pass.
- The implementation and test plan checkboxes reflect the merged code.
- No Cursor acceptance test requires Genspark authentication.
- A final review confirms the worker boundary, stale-session protection,
  argument limits, history cleanup, and PPTX round-trip behavior.
