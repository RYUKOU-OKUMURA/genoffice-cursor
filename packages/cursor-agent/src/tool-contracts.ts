/**
 * Portable custom-tool contract types shared by the worker (which registers
 * them with the Cursor SDK) and the Electron main registry (which re-validates
 * every call and is the only mutation authority — see docs/cursor/ARCHITECTURE.md
 * "Initial tool surface").
 *
 * Types only: no tool registrations and no SDK imports live here, so this
 * module stays importable from either process. The shapes are JSON-Schema-like
 * so a contract can be serialized into the SDK's custom-tool declaration and
 * checked by the main-side registry without a schema library (the repo uses
 * none).
 */

import type { JsonObject, JsonValue } from './protocol'

/**
 * Capability scope every tool must declare. `read` tools may only inspect the
 * pinned deck; `mutate` tools additionally count against the per-run mutation
 * and history budget. A tool with no declared scope is not registerable.
 */
export type CursorToolScope = 'read' | 'mutate'

/** One property of a tool input schema. Intentionally closed: no arbitrary
 * JSON Schema features, so the main registry can validate args by walking a
 * fixed shape instead of interpreting a schema language. */
export interface CursorToolSchemaField {
  readonly type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  readonly description?: string
  /** Closed value allowlist for this field. */
  readonly enum?: readonly string[]
  /** Element schema; required when `type` is 'array'. */
  readonly items?: CursorToolSchemaField
}

/** Input schema for one custom tool. `additionalProperties: false` keeps every
 * tool argument declared — undeclared keys must be rejected by the registry. */
export interface CursorToolInputSchema {
  readonly type: 'object'
  readonly properties: Readonly<Record<string, CursorToolSchemaField>>
  readonly required: readonly string[]
  readonly additionalProperties: false
}

/**
 * The full portable definition of one custom tool: its name on the closed
 * allowlist, the description the model sees, its JSON-Schema-shaped input,
 * and its capability scope marker.
 */
export interface CursorToolContract {
  readonly name: string
  readonly description: string
  readonly inputSchema: CursorToolInputSchema
  readonly scope: CursorToolScope
}

/** Tool results crossing the wire must be JSON-like; the registry returns
 * document-derived data only, never paths or bytes. */
export type CursorToolResultValue = JsonValue
export type CursorToolArgs = JsonObject
