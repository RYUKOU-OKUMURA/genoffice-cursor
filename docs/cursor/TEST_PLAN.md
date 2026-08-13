---
status: active
last-reviewed: 2026-08-13
---

# Slides Cursor test plan

## Test principles

- Deterministic protocol, validation, history, and PPTX tests run without a
  Cursor or Genspark account.
- Real Cursor tests are explicit local acceptance tests because they consume
  hosted requests and depend on account-specific models.
- The Genspark-independent acceptance run starts logged out with GSK variables
  unset and records any attempted call as a failure.
- Test only generated fixtures or copies. Never use the sole copy of a personal
  presentation.
- A screenshot is evidence for layout, not for native editability or round-trip
  fidelity; those need structural assertions too.

## Baseline before implementation

From the repository root:

```bash
npm run format:check -- --base origin/main
npm run lint
npm run typecheck
npm test
npm run licenses
```

For quick Slides iteration:

```bash
npm run typecheck -w @genoffice/slides
npm run test -w @genoffice/slides
npm run typecheck -w @genoffice/pptx-engine
npm run test -w @genoffice/pptx-engine
```

Add `@genoffice/cursor-agent` focused typecheck/tests after the workspace exists.
Run the full repository checks before every phase exit that changes shared
dependencies, shell main code, or packaging.

## Automated test matrix

<!-- markdownlint-disable MD013 -->

| Area                 | Required cases                                                                               | Intended location                              |
| -------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Worker protocol      | version/type validation, request correlation, timeout, duplicate/late messages, cancel, exit | `packages/cursor-agent/tests/`                 |
| SDK adapter          | mocked login/status/logout, models, streaming, tool callback, cancellation, redaction        | `packages/cursor-agent/tests/`                 |
| Capability isolation | only private custom tools offered; built-in/ambient capability probes rejected               | worker integration tests + local smoke         |
| Session pinning      | switch, replace, close, destroyed renderer, forged/stale capability, second run              | `apps/slides/tests/`                           |
| Argument validation  | indices, IDs, geometry, colors, presets, text/payload/call limits, prototype-shaped input    | `apps/slides/tests/`                           |
| Command parity       | manual IPC and Cursor registry call the same service and return equivalent render state      | `apps/slides/tests/`                           |
| History              | no-op, one edit, many edits, partial failure, cancel, timeout, crash; one undo step          | extend `apps/slides/tests/history.test.ts`     |
| Read tools           | bounded outline and slide output; Unicode; hidden/empty slides; stale IDs                    | `apps/slides/tests/`                           |
| Creation tools       | text box, shape, supported diagram layouts, safe margins, overlap checks                     | extend layout/SmartArt tests                   |
| PPTX fidelity        | save/reparse native text/shapes/diagram; untouched entries/content preserved                 | `packages/pptx-engine/tests/` and Slides tests |
| Renderer UI          | backend state, auth states, model fallback, events, cancel, theme/i18n                       | `apps/slides/tests/`                           |

<!-- markdownlint-enable MD013 -->

Existing tests to preserve include Slides history, slide scripts,
`generate-deck`, `regenerate-slide`, layout tools, picture tools, and PPTX
round-trip suites. Cursor must not regress the optional upstream Genspark path
while making it unnecessary for Cursor acceptance.

## Live Cursor smoke test

The opt-in smoke driver must:

1. Use an isolated temporary SDK store and GenOffice profile.
2. Display login URL/status without printing an API key or writing the shared
   default SDK credential path.
3. List the current model catalog and select a valid model/variant dynamically.
4. Complete a text-only stream.
5. Call a harmless parent-round-trip custom tool.
6. Demonstrate that `tools: ["mcp"]` reaches only the registered custom tool,
   while shell, file read/write/edit, web, task/subagent, and an unconfigured
   ambient MCP server are unavailable.
7. Demonstrate that `tools: []` disables the custom tool and that resume only
   works after reapplying the restricted configuration.
8. Cancel a slow run and shut down without an orphan utility process.
9. Redact the prompt, credentials, home paths, and event payload content from
   normal output.

It must be skipped by default in CI and fail with a clear message when no
Cursor credential is configured.

## Slides end-to-end acceptance

Start the fork with:

```bash
env -u GSK_API_KEY -u GSK_CLI_PATH \
  GENOFFICE_USER_DATA="$PWD/.task/user-data" npm run dev
```

Before the run, log out of Genspark in the isolated profile. Capture the commit
SHA, OS/architecture, Electron/Node/SDK versions, selected catalog model, and
whether a skill was enabled. Do not capture credentials or full personal
document contents.

Run every scenario from `SLIDES_MVP_REQUIREMENTS.md`. For the canonical creation
prompt, use a stable fixture such as:

> Create a slide titled "Cursor-powered workflow" with a concise three-step
> process diagram: Understand, Build, Verify. Use a clear visual hierarchy and
> keep every element inside safe margins.

Required evidence:

- run terminal state and tool-name sequence;
- before/after deck element inventory;
- rendered screenshot before save and after reopen;
- undo then redo inventory/screenshot;
- saved PPTX structural assertions proving native editable text and diagram
  elements;
- no Genspark request/CLI observation;
- first-run hosted-model/data-use disclosure and bounded context observation;
- stale-session, cancellation, and worker-crash results.

## Round-trip checks

For a generated fixture and one copied real-world PPTX:

1. Record the original archive-entry list and hashes.
2. Perform one bounded Cursor edit.
3. Save As to a new path.
4. Reopen through the PPTX engine and assert the intended model changes.
5. Confirm unrelated archive entries follow the existing preservation contract.
6. Render before save and after reopen at the same dimensions.
7. Assert no missing element, out-of-bounds geometry, NaN transform, empty
   required text, or unexpected fallback bitmap/HTML artifact.
8. Open the copy in PowerPoint or another compatible viewer for a manual native
   editability check before the packaged beta.

Visual differences need an explicit tolerance and diff artifact; a manual
"looks fine" is not sufficient as the only test.

## Security and abuse cases

- Prompt asks for `~/.ssh`, environment variables, Keychain, or another deck.
- Skill instructions ask to run shell, install a package, browse, or load an
  ambient MCP server.
- A selected skill package contains a symlink escape, oversized instruction,
  `.cursor/mcp.json`, hook, agent definition, executable, or undeclared script;
  only the approved bounded instruction/text assets may reach the run.
- Tool inputs include huge strings/arrays, `__proto__` keys, invalid Unicode,
  NaN/infinity, negative sizes, off-canvas coordinates, unsupported layouts,
  or stale IDs.
- A forged worker sends an unknown protocol version, capability, run ID, or
  duplicate result.
- The renderer tries to invoke a Cursor tool directly or observes auth data.
- The tab changes between tool request and response.
- The worker exits during mutation, login, and shutdown.
- Network is unavailable or a saved model disappears.

Each case must fail closed, preserve a usable document/history state, and
return an actionable but non-sensitive error.

## Personal packaged beta checks

On each Mac after Phase 7:

- `GenOffice.app` and `GenOffice Cursor.app` coexist in `/Applications`.
- Bundle IDs, product names, user-data directories, and single-instance locks
  are distinct.
- The personal package contains the correct worker and platform helper outside
  `app.asar`; sandbox startup and one custom tool work.
- No `app-update.yml` points to the official feed.
- Official GenOffice continues its own update behavior.
- Cursor login and settings remain local to each Mac.
- The same PPTX is never edited concurrently in both apps during testing.

## Evidence record

For each phase, add a concise verification note to its implementation commit or
PR description containing commands, pass/fail result, environment, and any
skipped live test. Do not commit credentials, raw SDK stores, personal prompts,
user PPTX files, or unredacted logs.
