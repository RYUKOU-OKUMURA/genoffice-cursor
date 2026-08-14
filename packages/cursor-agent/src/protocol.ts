/**
 * Versioned message protocol between the Electron main process (parent) and
 * the Cursor SDK utility-process worker.
 *
 * Security model (docs/cursor/ARCHITECTURE.md, ADR 0002):
 * - Both sides validate every message at runtime; a message that fails
 *   validation is rejected, never passed through ("fail closed").
 * - The wire carries JSON-like data only. It must never contain a file path,
 *   raw document bytes, credentials, Electron objects, or callable values.
 *   Validators reject unknown fields and non-JSON value kinds so injected or
 *   forged payloads are dropped structurally instead of being forwarded.
 * - Every request carries a unique request id so replies can be correlated to
 *   exactly one pending request. Run-scoped and tool-scoped messages also
 *   carry a run id and an opaque capability minted by the parent; the
 *   capability lets the parent reject stale or retargeted run traffic after
 *   cancellation, tab switches, or worker restarts.
 *
 * These validators enforce STRUCTURE only — message shape, field kinds, size
 * and count budgets, and JSON-likeness. Content inspection (a file path or a
 * credential hidden inside an otherwise well-formed string value) is the job
 * of the Electron main registry, never of this module.
 *
 * Any incompatible change to a message shape bumps CURSOR_PROTOCOL_VERSION so
 * the other side rejects the whole message instead of misreading it.
 */

export const CURSOR_PROTOCOL_VERSION = 1

/** Maximum accepted length for request ids, run ids, capabilities, and names. */
const MAX_ID_LENGTH = 256
/** Maximum accepted length for large instruction payloads (prompt, system). */
const MAX_TEXT_LENGTH = 1_000_000
/** Maximum accepted length for ordinary human-readable strings. */
const MAX_SHORT_TEXT_LENGTH = 10_000

// Size and count budgets for JSON-like payload values. Generous by design —
// they bound a hostile peer's ability to push multi-megabyte strings or
// unbounded collections across the wire; per-run semantic budgets (context
// size, tool calls, output) are Phase 6 work and belong to the caller.
/** Maximum nesting depth accepted inside JSON-like payload values. */
export const MAX_JSON_DEPTH = 32
/** Maximum length of any single string inside a JSON-like payload value. */
export const MAX_JSON_STRING_LENGTH = 100_000
/** Maximum element count of any array inside a JSON-like payload value. */
export const MAX_JSON_ARRAY_LENGTH = 1_000
/** Maximum key count of any object inside a JSON-like payload value. */
export const MAX_JSON_OBJECT_KEYS = 100
/** Maximum number of tool names a run may register (the allowlist is ~7 today). */
export const MAX_TOOL_NAMES = 64
/** Maximum number of models accepted in one models.result reply. */
export const MAX_MODELS = 256

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject
export interface JsonObject {
  [key: string]: JsonValue
}

/** Machine-readable error payload shared by reply and terminal messages. */
export interface ProtocolErrorPayload {
  readonly code: string
  readonly message: string
}

// ---------------------------------------------------------------------------
// Parent-to-worker messages
// ---------------------------------------------------------------------------

export type ParentToWorkerMessageType =
  | 'initialize'
  | 'auth.login'
  | 'auth.status'
  | 'auth.logout'
  | 'models.list'
  | 'run.start'
  | 'run.cancel'
  | 'shutdown'
  | 'tool.result'

/** Ask the worker to boot; the worker answers with `ready`. */
export interface InitializeMessage {
  readonly version: number
  readonly type: 'initialize'
  readonly requestId: string
}

/** Ask the worker to start Cursor browser login; answered by `auth.result`. */
export interface AuthLoginMessage {
  readonly version: number
  readonly type: 'auth.login'
  readonly requestId: string
}

/** Ask for the stored login state; answered by `auth.result`. */
export interface AuthStatusMessage {
  readonly version: number
  readonly type: 'auth.status'
  readonly requestId: string
}

/** Ask the worker to drop stored credentials; answered by `auth.result`. */
export interface AuthLogoutMessage {
  readonly version: number
  readonly type: 'auth.logout'
  readonly requestId: string
}

/** Ask for the account's model catalog; answered by `models.result`. */
export interface ModelsListMessage {
  readonly version: number
  readonly type: 'models.list'
  readonly requestId: string
}

/**
 * Start one agent run. The run id and capability are minted by the parent and
 * must be echoed by every later `run.*` / `tool.*` message for that run. The
 * terminal outcome arrives as `run.terminal`, correlated by request id.
 */
export interface RunStartMessage {
  readonly version: number
  readonly type: 'run.start'
  readonly requestId: string
  readonly runId: string
  readonly capability: string
  readonly prompt: string
  readonly modelId: string
  readonly systemInstruction?: string
  /** Tool names the run may call; the parent-side registry enforces the closed allowlist. */
  readonly toolNames: readonly string[]
}

/** Cancel one live run. Fire-and-forget; the run ends via `run.terminal`. */
export interface RunCancelMessage {
  readonly version: number
  readonly type: 'run.cancel'
  readonly requestId: string
  readonly runId: string
  readonly capability: string
  readonly reason?: string
}

/** Ask the worker to exit cleanly; no reply is expected. */
export interface ShutdownMessage {
  readonly version: number
  readonly type: 'shutdown'
  readonly requestId: string
}

/**
 * Parent's answer to one `tool.request`. Must match exactly one pending
 * request: an unknown, late, or duplicate result is rejected by the worker.
 */
export interface ToolResultMessage {
  readonly version: number
  readonly type: 'tool.result'
  readonly requestId: string
  readonly runId: string
  readonly capability: string
  readonly ok: boolean
  readonly result?: JsonValue
  readonly error?: ProtocolErrorPayload
}

// ---------------------------------------------------------------------------
// Worker-to-parent messages
// ---------------------------------------------------------------------------

export type WorkerToParentMessageType =
  | 'ready'
  | 'auth.result'
  | 'models.result'
  | 'run.event'
  | 'run.terminal'
  | 'tool.request'
  | 'worker.error'

/** Worker finished booting; the reply to `initialize`. */
export interface ReadyMessage {
  readonly version: number
  readonly type: 'ready'
  readonly requestId: string
  readonly sdkVersion?: string
}

export type AuthState = 'authenticated' | 'unauthenticated' | 'pending'

/** Reply to any `auth.*` request. Never carries a credential, only state and
 * account-safe metadata (docs/cursor/ARCHITECTURE.md). */
export interface AuthResultMessage {
  readonly version: number
  readonly type: 'auth.result'
  readonly requestId: string
  readonly state: AuthState
  /**
   * Login URL to open externally during interactive login. Only the https:
   * scheme is enforced here; validating the HOST (and anything else about the
   * navigation target) is the responsibility of the opener in Electron main,
   * which receives the URL for safe external opening per
   * docs/cursor/ARCHITECTURE.md — no host allowlist lives in this package.
   */
  readonly loginUrl?: string
  /** Account-safe display label, never a key or token. */
  readonly account?: string
  readonly error?: ProtocolErrorPayload
}

export interface CursorModelSummary {
  readonly id: string
  readonly name: string
  readonly description?: string
}

/** Reply to `models.list`. */
export interface ModelsResultMessage {
  readonly version: number
  readonly type: 'models.result'
  readonly requestId: string
  readonly models: readonly CursorModelSummary[]
  readonly error?: ProtocolErrorPayload
}

/** One streamed run notification. Not a reply; correlated by run id. */
export type RunEventPayload =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'tool-call'; readonly toolName: string }

export interface RunEventMessage {
  readonly version: number
  readonly type: 'run.event'
  readonly runId: string
  readonly capability: string
  readonly event: RunEventPayload
}

export type RunOutcome = 'completed' | 'cancelled' | 'error'

/**
 * Terminal state for one run; the reply to `run.start`. Exactly one terminal
 * is accepted per run id; a duplicate or post-cancel echo is rejected.
 */
export interface RunTerminalMessage {
  readonly version: number
  readonly type: 'run.terminal'
  readonly requestId: string
  readonly runId: string
  readonly capability: string
  readonly outcome: RunOutcome
  /** Required iff outcome is 'error'. */
  readonly error?: ProtocolErrorPayload
}

/**
 * Worker-side custom-tool invocation. The parent validates it against the
 * run's capability and closed tool allowlist, executes it, and answers with
 * exactly one `tool.result`.
 */
export interface ToolRequestMessage {
  readonly version: number
  readonly type: 'tool.request'
  readonly requestId: string
  readonly runId: string
  readonly capability: string
  readonly toolName: string
  readonly args: JsonObject
}

/**
 * Asynchronous worker failure not tied to a pending request reply (crash
 * report, stream failure, ...). May target one pending request id and/or one
 * run id when the failure belongs to them.
 */
export interface WorkerErrorMessage {
  readonly version: number
  readonly type: 'worker.error'
  readonly requestId?: string
  readonly runId?: string
  readonly error: ProtocolErrorPayload
}

export type ParentToWorkerMessage =
  | InitializeMessage
  | AuthLoginMessage
  | AuthStatusMessage
  | AuthLogoutMessage
  | ModelsListMessage
  | RunStartMessage
  | RunCancelMessage
  | ShutdownMessage
  | ToolResultMessage

export type WorkerToParentMessage =
  | ReadyMessage
  | AuthResultMessage
  | ModelsResultMessage
  | RunEventMessage
  | RunTerminalMessage
  | ToolRequestMessage
  | WorkerErrorMessage

export type CursorProtocolMessage = ParentToWorkerMessage | WorkerToParentMessage
export type CursorProtocolMessageType = ParentToWorkerMessageType | WorkerToParentMessageType

/**
 * Reply type each request expects, or null for fire-and-forget messages.
 * `tool.request`/`tool.result` are inverted relative to the other pairs: the
 * worker is the requester for tools.
 */
export type ExpectedReplyType =
  'ready' | 'auth.result' | 'models.result' | 'run.terminal' | 'tool.result'

export const EXPECTED_REPLY_TYPE: Readonly<
  Record<CursorProtocolMessageType, ExpectedReplyType | null>
> = {
  initialize: 'ready',
  'auth.login': 'auth.result',
  'auth.status': 'auth.result',
  'auth.logout': 'auth.result',
  'models.list': 'models.result',
  'run.start': 'run.terminal',
  'run.cancel': null,
  shutdown: null,
  'tool.result': null,
  ready: null,
  'auth.result': null,
  'models.result': null,
  'run.event': null,
  'run.terminal': null,
  'tool.request': 'tool.result',
  'worker.error': null,
}

// ---------------------------------------------------------------------------
// Rejections
// ---------------------------------------------------------------------------

/**
 * Why a message was refused. `invalid-version` / `unknown-type` /
 * `invalid-message` come from parsing; the rest come from correlation and run
 * bookkeeping (see protocol-channel.ts).
 */
export type ProtocolRejection =
  | { readonly kind: 'invalid-version'; readonly version: unknown }
  | { readonly kind: 'unknown-type'; readonly type: unknown }
  | { readonly kind: 'invalid-message'; readonly type: unknown; readonly detail: string }
  | {
      readonly kind: 'wrong-direction'
      readonly type: string
    }
  | { readonly kind: 'unknown-request-id'; readonly requestId: string; readonly type: string }
  | { readonly kind: 'unknown-run'; readonly runId: string; readonly type: string }
  | { readonly kind: 'capability-mismatch'; readonly runId: string; readonly type: string }
  | {
      readonly kind: 'run-mismatch'
      readonly requestId: string
      readonly type: string
      readonly runId: string
    }
  | { readonly kind: 'duplicate-run'; readonly runId: string; readonly type: string }
  | { readonly kind: 'duplicate-terminal'; readonly runId: string; readonly type: string }
  | {
      readonly kind: 'duplicate-tool-request'
      readonly requestId: string
      readonly runId: string
      readonly type: string
    }
  | { readonly kind: 'late-message'; readonly type: string; readonly runId?: string }
  | { readonly kind: 'timeout'; readonly requestId: string; readonly type: string }
  | { readonly kind: 'closed-channel' }

export type CursorProtocolParseResult =
  | { readonly ok: true; readonly message: CursorProtocolMessage }
  | { readonly ok: false; readonly rejection: ProtocolRejection }

// ---------------------------------------------------------------------------
// JSON-like value guards
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** True only for values JSON can represent: rejects functions, symbols,
 * `undefined`, `bigint`, non-finite numbers, class instances, and excessive
 * nesting, so non-JSON payloads fail validation instead of crossing the wire. */
export function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > MAX_JSON_DEPTH) return false
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true
    case 'number':
      // JSON has no NaN or Infinity.
      return Number.isFinite(value)
    case 'object': {
      if (value === null) return true
      if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1))
      if (!isPlainObject(value)) return false
      return Object.values(value).every((item) => isJsonValue(item, depth + 1))
    }
    default:
      // 'undefined', 'function', 'symbol', 'bigint' have no JSON form.
      return false
  }
}

export function isJsonObject(value: unknown): value is JsonObject {
  return isPlainObject(value) && Object.values(value).every((item) => isJsonValue(item))
}

/** Rejection details end up in logs; strip control characters and truncate so
 * a hostile field name cannot forge log lines or flood the log. */
const MAX_REJECTION_KEY_LENGTH = 40

function safeKey(key: string): string {
  let cleaned = ''
  for (const char of key) {
    const code = char.codePointAt(0) ?? 0
    // Drop C0 controls and DEL without a control-character regex.
    if (code >= 0x20 && code !== 0x7f) cleaned += char
  }
  return cleaned.length > MAX_REJECTION_KEY_LENGTH
    ? `${cleaned.slice(0, MAX_REJECTION_KEY_LENGTH)}...`
    : cleaned
}

/**
 * Budgeted JSON-likeness check used by the message validators (the exported
 * `isJsonValue` predicate stays budget-free for general use). Beyond the JSON
 * kinds it enforces the MAX_JSON_* budgets and refuses the three
 * prototype-pollution keys anywhere inside a value — they never cross the
 * wire, even as inert data. Returns the first violation as a detail string.
 */
function checkJsonValue(value: unknown, depth = 0): string | null {
  if (depth > MAX_JSON_DEPTH) return `nested deeper than ${MAX_JSON_DEPTH} levels`
  switch (typeof value) {
    case 'string':
      if (value.length > MAX_JSON_STRING_LENGTH) {
        return `string longer than ${MAX_JSON_STRING_LENGTH} characters`
      }
      return null
    case 'boolean':
      return null
    case 'number':
      // JSON has no NaN or Infinity.
      return Number.isFinite(value) ? null : 'non-finite number'
    case 'object': {
      if (value === null) return null
      if (Array.isArray(value)) {
        if (value.length > MAX_JSON_ARRAY_LENGTH) {
          return `array longer than ${MAX_JSON_ARRAY_LENGTH} elements`
        }
        for (const item of value) {
          const error = checkJsonValue(item, depth + 1)
          if (error) return error
        }
        return null
      }
      if (!isPlainObject(value)) return 'non-JSON object'
      const keys = Object.keys(value)
      if (keys.length > MAX_JSON_OBJECT_KEYS) {
        return `object with more than ${MAX_JSON_OBJECT_KEYS} keys`
      }
      for (const key of keys) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          return `forbidden key "${safeKey(key)}"`
        }
        const error = checkJsonValue(value[key], depth + 1)
        if (error) return error
      }
      return null
    }
    default:
      // 'undefined', 'function', 'symbol', 'bigint' have no JSON form.
      return 'non-JSON value kind'
  }
}

// ---------------------------------------------------------------------------
// Field checking
// ---------------------------------------------------------------------------

type StringOptions = { optional?: boolean; maxLength?: number }

/**
 * Strict per-message field collector. Unknown keys are errors — the protocol
 * is closed, so an injected field (for example a file path) can never ride
 * along inside an otherwise valid message.
 */
class MessageFields {
  private readonly errors: string[] = []

  constructor(
    private readonly fields: Record<string, unknown>,
    allowedKeys: readonly string[],
  ) {
    for (const key of Object.keys(fields)) {
      // Field names are attacker-controlled text: sanitize before embedding
      // them in the rejection detail (log-forging hardening).
      if (!allowedKeys.includes(key)) this.errors.push(`unknown field "${safeKey(key)}"`)
    }
  }

  /** Required non-empty identifier-bounded string. Returns '' once an error is recorded. */
  id(key: string): string {
    const value = this.fields[key]
    if (typeof value !== 'string' || value.length === 0) {
      this.errors.push(`"${key}" must be a non-empty string`)
      return ''
    }
    if (value.length > MAX_ID_LENGTH) {
      this.errors.push(`"${key}" must be at most ${MAX_ID_LENGTH} characters`)
      return ''
    }
    return value
  }

  string(
    key: string,
    options: StringOptions & { optional: true; maxLength: number },
  ): string | undefined
  string(key: string, options?: StringOptions): string
  string(key: string, options?: StringOptions): string | undefined {
    const value = this.fields[key]
    if (value === undefined) {
      if (options?.optional) return undefined
      this.errors.push(`"${key}" is required`)
      return undefined
    }
    if (typeof value !== 'string') {
      this.errors.push(`"${key}" must be a string`)
      return undefined
    }
    if (options?.maxLength !== undefined && value.length > options.maxLength) {
      this.errors.push(`"${key}" must be at most ${options.maxLength} characters`)
      return undefined
    }
    return value
  }

  /** Required string restricted to an allowlist of literals. */
  literal<T extends string>(key: string, values: readonly T[]): T {
    const value = this.fields[key]
    if (value === undefined) {
      this.errors.push(`"${key}" is required`)
      return values[0]
    }
    if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
      this.errors.push(`"${key}" must be one of: ${values.join(', ')}`)
      return values[0]
    }
    return value as T
  }

  boolean(key: string): boolean {
    const value = this.fields[key]
    if (typeof value !== 'boolean') {
      this.errors.push(`"${key}" must be a boolean`)
      return false
    }
    return value
  }

  /** Required JSON-like value within the MAX_JSON_* budgets; rejects non-JSON
   * kinds (functions, undefined, NaN, ...), oversized strings, unbounded
   * collections, and prototype-pollution keys. */
  json(key: string): JsonValue {
    const value = this.fields[key]
    const error = checkJsonValue(value)
    if (error) {
      this.errors.push(`"${key}": ${error}`)
      return null
    }
    return value as JsonValue
  }

  /** Required JSON-like object within the MAX_JSON_* budgets. */
  jsonObject(key: string): JsonObject {
    const value = this.fields[key]
    if (!isJsonObject(value)) {
      this.errors.push(`"${key}" must be a JSON-like object`)
      return {}
    }
    const error = checkJsonValue(value)
    if (error) {
      this.errors.push(`"${key}": ${error}`)
      return {}
    }
    return value
  }

  /** Optional URL restricted to the https: scheme. Scheme only — host
   * validation belongs to the opener in Electron main, not to this package. */
  httpsUrl(key: string): string | undefined {
    const value = this.fields[key]
    if (value === undefined) return undefined
    if (typeof value !== 'string' || !value.startsWith('https://') || value.length <= 8) {
      this.errors.push(`"${key}" must be an https: URL`)
      return undefined
    }
    if (value.length > MAX_SHORT_TEXT_LENGTH) {
      this.errors.push(`"${key}" must be at most ${MAX_SHORT_TEXT_LENGTH} characters`)
      return undefined
    }
    return value
  }

  /** Required array of non-empty, identifier-bounded strings (tool names). */
  stringArray(key: string): readonly string[] {
    const value = this.fields[key]
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== 'string' || item.length === 0)
    ) {
      this.errors.push(`"${key}" must be an array of non-empty strings`)
      return []
    }
    if (value.length > MAX_TOOL_NAMES) {
      this.errors.push(`"${key}" must contain at most ${MAX_TOOL_NAMES} entries`)
      return []
    }
    if (value.some((item) => item.length > MAX_ID_LENGTH)) {
      this.errors.push(`"${key}" entries must be at most ${MAX_ID_LENGTH} characters`)
      return []
    }
    return value as readonly string[]
  }

  /** Optional error payload with a closed shape of its own. */
  errorPayload(key: string): ProtocolErrorPayload | undefined {
    const value = this.fields[key]
    if (value === undefined) return undefined
    if (!isPlainObject(value)) {
      this.errors.push(`"${key}" must be an object`)
      return undefined
    }
    const check = new MessageFields(value, ['code', 'message'])
    const code = check.id('code')
    const message = check.string('message', { maxLength: MAX_SHORT_TEXT_LENGTH })
    const detail = check.finish()
    if (detail) {
      this.errors.push(`"${key}": ${detail}`)
      return undefined
    }
    return { code, message }
  }

  finish(): string | null {
    return this.errors.length > 0 ? this.errors.join('; ') : null
  }
}

// ---------------------------------------------------------------------------
// Per-message validators
// ---------------------------------------------------------------------------

type MessageParser = (fields: Record<string, unknown>) => CursorProtocolMessage | string

type BareMessageType =
  'initialize' | 'auth.login' | 'auth.status' | 'auth.logout' | 'models.list' | 'shutdown'

/** Parser for request types whose payload is only the request id. */
function bareMessage(type: BareMessageType): MessageParser {
  return (fields) => {
    const check = new MessageFields(fields, ['version', 'type', 'requestId'])
    const requestId = check.id('requestId')
    const detail = check.finish()
    if (detail) return detail
    // Safe by construction: the message table above calls this only with the
    // payload-free literal types, all of which have exactly this shape.
    return { version: CURSOR_PROTOCOL_VERSION, type, requestId } as CursorProtocolMessage
  }
}

function parseRunStart(fields: Record<string, unknown>): RunStartMessage | string {
  const check = new MessageFields(fields, [
    'version',
    'type',
    'requestId',
    'runId',
    'capability',
    'prompt',
    'modelId',
    'systemInstruction',
    'toolNames',
  ])
  const requestId = check.id('requestId')
  const runId = check.id('runId')
  const capability = check.id('capability')
  const prompt = check.string('prompt', { maxLength: MAX_TEXT_LENGTH })
  const modelId = check.id('modelId')
  const systemInstruction = check.string('systemInstruction', {
    optional: true,
    maxLength: MAX_TEXT_LENGTH,
  })
  const toolNames = check.stringArray('toolNames')
  const detail = check.finish()
  if (detail) return detail
  const message: RunStartMessage = {
    version: CURSOR_PROTOCOL_VERSION,
    type: 'run.start',
    requestId,
    runId,
    capability,
    prompt,
    modelId,
    toolNames,
  }
  return systemInstruction === undefined ? message : { ...message, systemInstruction }
}

function parseRunCancel(fields: Record<string, unknown>): RunCancelMessage | string {
  const check = new MessageFields(fields, [
    'version',
    'type',
    'requestId',
    'runId',
    'capability',
    'reason',
  ])
  const requestId = check.id('requestId')
  const runId = check.id('runId')
  const capability = check.id('capability')
  const reason = check.string('reason', { optional: true, maxLength: MAX_SHORT_TEXT_LENGTH })
  const detail = check.finish()
  if (detail) return detail
  const message: RunCancelMessage = {
    version: CURSOR_PROTOCOL_VERSION,
    type: 'run.cancel',
    requestId,
    runId,
    capability,
  }
  return reason === undefined ? message : { ...message, reason }
}

function parseToolResult(fields: Record<string, unknown>): ToolResultMessage | string {
  const check = new MessageFields(fields, [
    'version',
    'type',
    'requestId',
    'runId',
    'capability',
    'ok',
    'result',
    'error',
  ])
  const requestId = check.id('requestId')
  const runId = check.id('runId')
  const capability = check.id('capability')
  const ok = check.boolean('ok')
  const hasResult = fields.result !== undefined
  const result = hasResult ? check.json('result') : undefined
  const error = check.errorPayload('error')
  const detail = check.finish()
  if (detail) return detail
  // Exactly one of result/error accompanies the ok flag, so a failed call can
  // never smuggle a partial result past the correlation layer.
  if (ok && error !== undefined) return '"error" must be absent when ok is true'
  if (!ok && error === undefined) return '"error" is required when ok is false'
  if (!ok && hasResult) return '"result" must be absent when ok is false'
  const message: ToolResultMessage = {
    version: CURSOR_PROTOCOL_VERSION,
    type: 'tool.result',
    requestId,
    runId,
    capability,
    ok,
  }
  if (result !== undefined && ok) return { ...message, result }
  if (error !== undefined) return { ...message, error }
  return message
}

function parseReady(fields: Record<string, unknown>): ReadyMessage | string {
  const check = new MessageFields(fields, ['version', 'type', 'requestId', 'sdkVersion'])
  const requestId = check.id('requestId')
  const sdkVersion = check.string('sdkVersion', {
    optional: true,
    maxLength: MAX_SHORT_TEXT_LENGTH,
  })
  const detail = check.finish()
  if (detail) return detail
  const message: ReadyMessage = { version: CURSOR_PROTOCOL_VERSION, type: 'ready', requestId }
  return sdkVersion === undefined ? message : { ...message, sdkVersion }
}

function parseAuthResult(fields: Record<string, unknown>): AuthResultMessage | string {
  const check = new MessageFields(fields, [
    'version',
    'type',
    'requestId',
    'state',
    'loginUrl',
    'account',
    'error',
  ])
  const requestId = check.id('requestId')
  const state = check.literal('state', ['authenticated', 'unauthenticated', 'pending'] as const)
  const loginUrl = check.httpsUrl('loginUrl')
  const account = check.string('account', { optional: true, maxLength: MAX_SHORT_TEXT_LENGTH })
  const error = check.errorPayload('error')
  const detail = check.finish()
  if (detail) return detail
  const message: AuthResultMessage = {
    version: CURSOR_PROTOCOL_VERSION,
    type: 'auth.result',
    requestId,
    state,
  }
  const withLoginUrl = loginUrl === undefined ? message : { ...message, loginUrl }
  const withAccount = account === undefined ? withLoginUrl : { ...withLoginUrl, account }
  return error === undefined ? withAccount : { ...withAccount, error }
}

function parseModelsResult(fields: Record<string, unknown>): ModelsResultMessage | string {
  const check = new MessageFields(fields, ['version', 'type', 'requestId', 'models', 'error'])
  const requestId = check.id('requestId')
  const models: CursorModelSummary[] = []
  const rawModels = fields.models
  if (!Array.isArray(rawModels)) return '"models" must be an array'
  if (rawModels.length > MAX_MODELS) {
    return `"models" must contain at most ${MAX_MODELS} entries`
  }
  for (const raw of rawModels) {
    if (!isPlainObject(raw)) return '"models" entries must be objects'
    const entry = new MessageFields(raw, ['id', 'name', 'description'])
    const id = entry.id('id')
    const name = entry.string('name', { maxLength: MAX_SHORT_TEXT_LENGTH })
    const description = entry.string('description', {
      optional: true,
      maxLength: MAX_SHORT_TEXT_LENGTH,
    })
    const entryDetail = entry.finish()
    if (entryDetail) return `"models" entry: ${entryDetail}`
    models.push(description === undefined ? { id, name } : { id, name, description })
  }
  const error = check.errorPayload('error')
  const detail = check.finish()
  if (detail) return detail
  const message: ModelsResultMessage = {
    version: CURSOR_PROTOCOL_VERSION,
    type: 'models.result',
    requestId,
    models,
  }
  return error === undefined ? message : { ...message, error }
}

function parseRunEvent(fields: Record<string, unknown>): RunEventMessage | string {
  const check = new MessageFields(fields, ['version', 'type', 'runId', 'capability', 'event'])
  const runId = check.id('runId')
  const capability = check.id('capability')
  const rawEvent = fields.event
  const event = parseRunEventPayload(rawEvent)
  if (typeof event === 'string') return `"event": ${event}`
  const detail = check.finish()
  if (detail) return detail
  return { version: CURSOR_PROTOCOL_VERSION, type: 'run.event', runId, capability, event }
}

function parseRunEventPayload(value: unknown): RunEventPayload | string {
  if (!isPlainObject(value)) return 'must be an object'
  if (value.kind === 'text') {
    const check = new MessageFields(value, ['kind', 'text'])
    const text = check.string('text', { maxLength: MAX_SHORT_TEXT_LENGTH })
    const detail = check.finish()
    if (detail) return detail
    return { kind: 'text', text }
  }
  if (value.kind === 'tool-call') {
    const check = new MessageFields(value, ['kind', 'toolName'])
    const toolName = check.id('toolName')
    const detail = check.finish()
    if (detail) return detail
    return { kind: 'tool-call', toolName }
  }
  return '"kind" must be "text" or "tool-call"'
}

function parseRunTerminal(fields: Record<string, unknown>): RunTerminalMessage | string {
  const check = new MessageFields(fields, [
    'version',
    'type',
    'requestId',
    'runId',
    'capability',
    'outcome',
    'error',
  ])
  const requestId = check.id('requestId')
  const runId = check.id('runId')
  const capability = check.id('capability')
  const outcome = check.literal('outcome', ['completed', 'cancelled', 'error'] as const)
  const error = check.errorPayload('error')
  const detail = check.finish()
  if (detail) return detail
  if (outcome === 'error' && error === undefined)
    return '"error" is required when outcome is "error"'
  if (outcome !== 'error' && error !== undefined)
    return '"error" must be absent unless outcome is "error"'
  const message: RunTerminalMessage = {
    version: CURSOR_PROTOCOL_VERSION,
    type: 'run.terminal',
    requestId,
    runId,
    capability,
    outcome,
  }
  return error === undefined ? message : { ...message, error }
}

function parseToolRequest(fields: Record<string, unknown>): ToolRequestMessage | string {
  const check = new MessageFields(fields, [
    'version',
    'type',
    'requestId',
    'runId',
    'capability',
    'toolName',
    'args',
  ])
  const requestId = check.id('requestId')
  const runId = check.id('runId')
  const capability = check.id('capability')
  const toolName = check.id('toolName')
  const args = check.jsonObject('args')
  const detail = check.finish()
  if (detail) return detail
  return {
    version: CURSOR_PROTOCOL_VERSION,
    type: 'tool.request',
    requestId,
    runId,
    capability,
    toolName,
    args,
  }
}

function parseWorkerError(fields: Record<string, unknown>): WorkerErrorMessage | string {
  const check = new MessageFields(fields, ['version', 'type', 'requestId', 'runId', 'error'])
  const hasRequestId = fields.requestId !== undefined
  const requestId = hasRequestId ? check.id('requestId') : undefined
  const hasRunId = fields.runId !== undefined
  const runId = hasRunId ? check.id('runId') : undefined
  const hasError = fields.error !== undefined
  const error = check.errorPayload('error')
  const detail = check.finish()
  if (detail) return detail
  if (!hasError || error === undefined) return '"error" is required'
  const message: WorkerErrorMessage = {
    version: CURSOR_PROTOCOL_VERSION,
    type: 'worker.error',
    error,
  }
  const withRequestId = requestId === undefined ? message : { ...message, requestId }
  return runId === undefined ? withRequestId : { ...withRequestId, runId }
}

// A Map (not a plain object) so inherited keys like "constructor" can never
// resolve to something truthy and slip an arbitrary message through dispatch.
const MESSAGE_PARSERS = new Map<string, MessageParser>([
  ['initialize', bareMessage('initialize')],
  ['auth.login', bareMessage('auth.login')],
  ['auth.status', bareMessage('auth.status')],
  ['auth.logout', bareMessage('auth.logout')],
  ['models.list', bareMessage('models.list')],
  ['run.start', parseRunStart],
  ['run.cancel', parseRunCancel],
  ['shutdown', bareMessage('shutdown')],
  ['tool.result', parseToolResult],
  ['ready', parseReady],
  ['auth.result', parseAuthResult],
  ['models.result', parseModelsResult],
  ['run.event', parseRunEvent],
  ['run.terminal', parseRunTerminal],
  ['tool.request', parseToolRequest],
  ['worker.error', parseWorkerError],
])

export function isParentToWorkerType(type: string): type is ParentToWorkerMessageType {
  return [
    'initialize',
    'auth.login',
    'auth.status',
    'auth.logout',
    'models.list',
    'run.start',
    'run.cancel',
    'shutdown',
    'tool.result',
  ].includes(type)
}

export function isWorkerToParentType(type: string): type is WorkerToParentMessageType {
  return [
    'ready',
    'auth.result',
    'models.result',
    'run.event',
    'run.terminal',
    'tool.request',
    'worker.error',
  ].includes(type)
}

/**
 * Validate one raw message against the protocol. Returns the typed message or
 * a rejection describing the first problem; never throws and never mutates
 * the input. Both the parent and the worker run this on every incoming
 * message before any correlation or side effect.
 */
export function parseCursorProtocolMessage(raw: unknown): CursorProtocolParseResult {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      rejection: {
        kind: 'invalid-message',
        type: undefined,
        detail: 'message must be a plain JSON object',
      },
    }
  }
  const version = raw.version
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version !== CURSOR_PROTOCOL_VERSION
  ) {
    // Unknown versions are rejected wholesale: an old or new peer must never
    // have a message partially interpreted against the current shape.
    return { ok: false, rejection: { kind: 'invalid-version', version } }
  }
  const type = raw.type
  if (typeof type !== 'string') {
    return { ok: false, rejection: { kind: 'unknown-type', type } }
  }
  const parser = MESSAGE_PARSERS.get(type)
  if (!parser) {
    return { ok: false, rejection: { kind: 'unknown-type', type } }
  }
  const parsed = parser(raw)
  if (typeof parsed === 'string') {
    return { ok: false, rejection: { kind: 'invalid-message', type, detail: parsed } }
  }
  return { ok: true, message: parsed }
}
