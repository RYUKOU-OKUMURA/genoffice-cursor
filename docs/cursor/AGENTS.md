# Cursor Documentation Instructions

These instructions apply to `docs/cursor/**` and extend the repository root
instructions. This directory is the fork's source of truth, not a scratchpad.

## Document ownership

- `PRODUCT.md` owns outcome, scope, and non-goals.
- `SLIDES_MVP_REQUIREMENTS.md` owns testable product requirements and
  acceptance scenarios.
- `ARCHITECTURE.md` owns component and trust boundaries.
- `IMPLEMENTATION_PLAN.md` owns phase order, dependencies, and exit gates.
- `TEST_PLAN.md` owns verification and evidence requirements.
- `OPERATIONS.md` owns local setup, app coexistence, Git/upstream, and two-Mac
  operation.
- `REFERENCE_CATALOG.md` owns required/conditional/deferred source routing.
- `docs/adr/*` records accepted durable decisions. Do not hide a durable
  decision only in a mutable task checklist.

Update the owning document and link to it elsewhere. Do not copy the same
requirement into multiple files with slightly different wording. Keep
`docs/CURSOR_INTEGRATION.md` as a redirect only.

## Accuracy and status

- Distinguish current implementation from target design. Inspect the current
  branch before writing "supports", "uses", "is implemented", or "passes".
- Keep frontmatter status accurate. Do not mark a plan item complete or an exit
  gate passed without recorded evidence.
- Preserve the Genspark-independent Slides acceptance requirement and the
  separate official/personal app identities unless a new user decision and ADR
  explicitly replace them.
- When a branch, repository, path, remote, package, command, or SDK behavior
  changes, update every owning operations/reference entry in the same change.
- Use current official primary documentation for changeable Cursor SDK or
  Electron claims. Record a versioned spike result when runtime behavior, not
  documentation alone, is the actual decision gate.
- Keep code symbols, IPC names, tool names, paths, commands, and acceptance IDs
  exact and internally consistent.

## Editing and verification

- Developer documentation is English-only and should be concise enough to
  guide implementation without duplicating source code.
- Prefer relative Markdown links inside the repository and direct official
  links for external technical sources.
- Run `npm run format` after edits. Before committing a documentation set, run
  `npm run format:check -- --base origin/main`.
- Validate every changed local Markdown link and search for stale repository
  names, paths, old source-of-truth links, and contradictory status language.
- Review requirements, architecture, implementation phases, tests, operations,
  ADRs, and applicable `AGENTS.md` files as one system before committing.

Documentation review must reject claims that grant broader agent capability
than the architecture, depend on Genspark for Cursor acceptance, imply source
changes update an installed app, or mark unverified work complete.
