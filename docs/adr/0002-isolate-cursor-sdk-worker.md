---
status: accepted
---

# Isolate the Cursor SDK in a utility process

The Slides Cursor integration will run `@cursor/sdk` in a dedicated
Node-capable Electron utility process. Electron main owns that process and
communicates over a versioned, runtime-validated message protocol. The worker
does not run inside a renderer or the shell's bundled main entry and does not
receive direct access to Slides sessions, Electron APIs, credentials outside
its own Cursor store, or document paths.

Cursor custom-tool callbacks send typed requests to Electron main. Main pins
each run to the initiating Slides session, validates the request again, and
invokes the same command service used by normal Slides IPC. Main remains the
authorization and document-mutation boundary.

## Context

The SDK is Node-first, requires Node.js 22.13 or later, lazily loads runtime
chunks, and ships per-platform native helpers. GenOffice's shell build bundles
main-process imports, so importing the SDK directly into that entry risks
missing lazy resources and mixes agent failures with the document host.

The SDK's local runtime is also permissive by default: headless built-in tools
run without interactive approval, the sandbox defaults off, and custom tools
skip interactive approval. Slides editing therefore needs a smaller boundary
than the process that owns all open documents.

## Considered options

- **Import the SDK in the Slides renderer** was rejected because renderers are
  sandboxed and must not receive credentials, Node access, or document
  authority.
- **Import the SDK into the bundled Electron main entry** was rejected because
  of lazy/native packaging risk, shared-process failure impact, and a broader
  privilege surface.
- **Use a Cursor cloud agent** was rejected because local custom tools are not
  supported there and the active local document must remain authoritative.
- **Run a separate external daemon** was deferred because it adds installation,
  discovery, and lifecycle complexity for a personal desktop app.
- **Use an Electron utility process** was selected because Electron owns its
  lifecycle, it supplies a Node environment compatible with the current SDK,
  and its message boundary can carry only the protocol capabilities we grant.

## Consequences

- The first implementation must prove SDK/custom-tool isolation and utility
  process compatibility before connecting to Slides.
- The worker protocol and main-side validation become security-sensitive code
  with dedicated tests.
- One worker crash can terminate an agent run without terminating manual Slides
  editing.
- The packaged app must ship the compiled worker, SDK lazy runtime, and matching
  platform helper outside `app.asar` and fail packaging when they are missing.
- Sandbox and SDK tool restrictions are defense in depth. Main-side session
  capabilities, schemas, bounds, and command services remain authoritative.
- If the Phase 1 spike proves that the required custom-tool-only configuration
  cannot be enforced or the utility process cannot load the SDK reliably, this
  ADR must be revised before any document tool is enabled.
