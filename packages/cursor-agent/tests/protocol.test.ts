import { describe, expect, it } from 'vitest'

import {
  CURSOR_PROTOCOL_VERSION,
  MAX_JSON_ARRAY_LENGTH,
  MAX_JSON_DEPTH,
  MAX_JSON_OBJECT_KEYS,
  MAX_JSON_STRING_LENGTH,
  MAX_MODELS,
  MAX_TOOL_NAMES,
  isJsonObject,
  isJsonValue,
  parseCursorProtocolMessage,
  type CursorProtocolMessage,
} from '../src/index'

const V = CURSOR_PROTOCOL_VERSION

/** One valid instance of every message family from docs/cursor/ARCHITECTURE.md. */
const VALID_MESSAGES: readonly CursorProtocolMessage[] = [
  { version: V, type: 'initialize', requestId: 'r1' },
  { version: V, type: 'auth.login', requestId: 'r2' },
  { version: V, type: 'auth.status', requestId: 'r3' },
  { version: V, type: 'auth.logout', requestId: 'r4' },
  { version: V, type: 'models.list', requestId: 'r5' },
  {
    version: V,
    type: 'run.start',
    requestId: 'r6',
    runId: 'run-1',
    capability: 'cap-1',
    prompt: 'Summarize the deck',
    modelId: 'grok-4',
    systemInstruction: 'Be brief.',
    toolNames: ['get_deck_context', 'read_slide'],
  },
  {
    version: V,
    type: 'run.cancel',
    requestId: 'r7',
    runId: 'run-1',
    capability: 'cap-1',
    reason: 'user cancel',
  },
  { version: V, type: 'shutdown', requestId: 'r8' },
  {
    version: V,
    type: 'tool.result',
    requestId: 'r9',
    runId: 'run-1',
    capability: 'cap-1',
    ok: true,
    result: { slideIndex: 0, title: 'Quarterly Review' },
  },
  { version: V, type: 'ready', requestId: 'r1', sdkVersion: '0.1.0' },
  {
    version: V,
    type: 'auth.result',
    requestId: 'r2',
    state: 'pending',
    loginUrl: 'https://cursor.com/device-login',
    account: 'owner@example.com',
  },
  {
    version: V,
    type: 'models.result',
    requestId: 'r5',
    models: [
      { id: 'grok-4', name: 'Grok 4', description: 'fast default' },
      { id: 'claude-opus-4', name: 'Claude Opus 4' },
    ],
  },
  {
    version: V,
    type: 'run.event',
    runId: 'run-1',
    capability: 'cap-1',
    event: { kind: 'text', text: 'Reading deck' },
  },
  {
    version: V,
    type: 'run.event',
    runId: 'run-1',
    capability: 'cap-1',
    event: { kind: 'tool-call', toolName: 'read_slide' },
  },
  {
    version: V,
    type: 'run.terminal',
    requestId: 'r6',
    runId: 'run-1',
    capability: 'cap-1',
    outcome: 'completed',
  },
  {
    version: V,
    type: 'run.terminal',
    requestId: 'r6b',
    runId: 'run-1b',
    capability: 'cap-1',
    outcome: 'error',
    error: { code: 'provider-error', message: 'stream failed' },
  },
  {
    version: V,
    type: 'tool.request',
    requestId: 'r10',
    runId: 'run-1',
    capability: 'cap-1',
    toolName: 'read_slide',
    args: { slideIndex: 1 },
  },
  { version: V, type: 'worker.error', error: { code: 'sdk-crash', message: 'agent crashed' } },
  {
    version: V,
    type: 'worker.error',
    requestId: 'r5',
    runId: 'run-1',
    error: { code: 'stream-lost', message: 'eof' },
  },
]

const TOOL_REQUEST_BASE = {
  version: V,
  type: 'tool.request',
  requestId: 'r',
  runId: 'run-1',
  capability: 'cap',
  toolName: 'read_slide',
} as const

describe('parseCursorProtocolMessage', () => {
  it('accepts one valid message per family', () => {
    for (const message of VALID_MESSAGES) {
      const parsed = parseCursorProtocolMessage(message)
      expect(parsed.ok, `expected ${message.type} to parse`).toBe(true)
      if (parsed.ok) expect(parsed.message.type).toBe(message.type)
    }
  })

  it('returns the typed message with its payload intact', () => {
    const parsed = parseCursorProtocolMessage(VALID_MESSAGES.find((m) => m.type === 'run.start'))
    expect(parsed).toMatchObject({
      ok: true,
      message: {
        version: V,
        type: 'run.start',
        requestId: 'r6',
        runId: 'run-1',
        capability: 'cap-1',
        modelId: 'grok-4',
        systemInstruction: 'Be brief.',
      },
    })
  })

  it('rejects non-object input', () => {
    for (const raw of ['initialize', 42, null, [1, 2], () => 'x']) {
      const parsed = parseCursorProtocolMessage(raw)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.rejection.kind).toBe('invalid-message')
    }
  })

  it('rejects unknown protocol versions wholesale', () => {
    for (const version of [0, 2, -1, 1.5, '1', null, undefined]) {
      const parsed = parseCursorProtocolMessage({ version, type: 'initialize', requestId: 'r1' })
      expect(parsed.ok, `version ${String(version)} must be rejected`).toBe(false)
      if (!parsed.ok) expect(parsed.rejection.kind).toBe('invalid-version')
    }
    const missing = parseCursorProtocolMessage({ type: 'initialize', requestId: 'r1' })
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.rejection.kind).toBe('invalid-version')
  })

  it('rejects unknown or non-string message types', () => {
    for (const raw of [
      { version: V, type: 'auth.refresh', requestId: 'r1' },
      { version: V, type: 7, requestId: 'r1' },
      { version: V, requestId: 'r1' },
      { version: V, type: 'constructor', requestId: 'r1' },
    ]) {
      const parsed = parseCursorProtocolMessage(raw)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.rejection.kind).toBe('unknown-type')
    }
  })

  it('rejects unknown fields, so injected payloads cannot ride along', () => {
    const parsed = parseCursorProtocolMessage({
      version: V,
      type: 'initialize',
      requestId: 'r1',
      filePath: '/Users/owner/secret-deck.pptx',
    })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.rejection.kind).toBe('invalid-message')
      if (parsed.rejection.kind === 'invalid-message') {
        expect(parsed.rejection.detail).toContain('unknown field "filePath"')
      }
    }
  })

  it('sanitizes hostile field names in rejection details', () => {
    const hostile = `owned`.repeat(60)
    const parsed = parseCursorProtocolMessage({
      version: V,
      type: 'initialize',
      requestId: 'r1',
      [`forged\n${hostile}`]: 1,
    })
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) {
      expect(parsed.rejection.kind).toBe('invalid-message')
      if (parsed.rejection.kind === 'invalid-message') {
        // No control characters (log-forging) and bounded length.
        expect(parsed.rejection.detail).not.toContain('\n')
        expect(parsed.rejection.detail.length).toBeLessThan(120)
        expect(parsed.rejection.detail).toContain('unknown field')
      }
    }
  })

  it('rejects missing, empty, non-string, and oversized request ids', () => {
    for (const requestId of [undefined, '', 123, 'x'.repeat(257)]) {
      const parsed = parseCursorProtocolMessage({ version: V, type: 'initialize', requestId })
      expect(parsed.ok, `requestId ${String(requestId)} must be rejected`).toBe(false)
      if (!parsed.ok) expect(parsed.rejection.kind).toBe('invalid-message')
    }
  })

  it('requires run id and capability on run-scoped and tool-scoped messages', () => {
    for (const raw of [
      { version: V, type: 'run.start', requestId: 'r', prompt: 'p', modelId: 'm', toolNames: [] },
      { version: V, type: 'run.cancel', requestId: 'r', runId: 'run-1' },
      {
        version: V,
        type: 'run.event',
        runId: 'run-1',
        event: { kind: 'text', text: 't' },
      },
      {
        version: V,
        type: 'tool.request',
        requestId: 'r',
        runId: 'run-1',
        capability: 'cap',
        toolName: 'read_slide',
      },
      { version: V, type: 'run.terminal', requestId: 'r', runId: 'run-1', outcome: 'completed' },
    ]) {
      const parsed = parseCursorProtocolMessage(raw)
      expect(parsed.ok, `${String(raw.type)} must require runId and capability`).toBe(false)
      if (!parsed.ok) expect(parsed.rejection.kind).toBe('invalid-message')
    }
  })

  it('rejects non-JSON value kinds inside tool args and results', () => {
    for (const args of [
      { slideIndex: Number.NaN },
      { fn: () => 1 },
      { missing: undefined },
      { when: new Date() },
      { map: new Map() },
    ]) {
      const parsed = parseCursorProtocolMessage({ ...TOOL_REQUEST_BASE, args })
      expect(parsed.ok, `args ${JSON.stringify(String(args))} must be rejected`).toBe(false)
      if (!parsed.ok) expect(parsed.rejection.kind).toBe('invalid-message')
    }
  })

  it('rejects JSON payloads over their size and count budgets', () => {
    const longString = parseCursorProtocolMessage({
      ...TOOL_REQUEST_BASE,
      args: { text: 'x'.repeat(MAX_JSON_STRING_LENGTH + 1) },
    })
    expect(longString.ok).toBe(false)

    const manyKeys = Object.fromEntries(
      Array.from({ length: MAX_JSON_OBJECT_KEYS + 1 }, (_, i) => [`k${i}`, i]),
    )
    expect(parseCursorProtocolMessage({ ...TOOL_REQUEST_BASE, args: manyKeys }).ok).toBe(false)

    const longArray = Array.from({ length: MAX_JSON_ARRAY_LENGTH + 1 }, (_, i) => i)
    expect(
      parseCursorProtocolMessage({ ...TOOL_REQUEST_BASE, args: { items: longArray } }).ok,
    ).toBe(false)

    const manyModels = Array.from({ length: MAX_MODELS + 1 }, (_, i) => ({
      id: `m${i}`,
      name: 'M',
    }))
    expect(
      parseCursorProtocolMessage({
        version: V,
        type: 'models.result',
        requestId: 'r',
        models: manyModels,
      }).ok,
    ).toBe(false)

    const manyTools = Array.from({ length: MAX_TOOL_NAMES + 1 }, (_, i) => `tool_${i}`)
    expect(
      parseCursorProtocolMessage({
        version: V,
        type: 'run.start',
        requestId: 'r',
        runId: 'run-1',
        capability: 'cap',
        prompt: 'p',
        modelId: 'm',
        toolNames: manyTools,
      }).ok,
    ).toBe(false)
  })

  it('rejects prototype-pollution keys anywhere inside JSON payloads', () => {
    const protoKey = parseCursorProtocolMessage({
      ...TOOL_REQUEST_BASE,
      args: JSON.parse('{"__proto__":{"injected":1}}'),
    })
    expect(protoKey.ok).toBe(false)
    const nestedPrototype = parseCursorProtocolMessage({
      ...TOOL_REQUEST_BASE,
      args: { shape: { prototype: true } },
    })
    expect(nestedPrototype.ok).toBe(false)
    const arrayConstructor = parseCursorProtocolMessage({
      ...TOOL_REQUEST_BASE,
      args: { list: [{ constructor: 'x' }] },
    })
    expect(arrayConstructor.ok).toBe(false)
  })

  it('rejects excessive nesting in JSON payloads', () => {
    let deep: unknown = 1
    for (let i = 0; i < MAX_JSON_DEPTH + 5; i++) deep = [deep]
    const parsed = parseCursorProtocolMessage({ ...TOOL_REQUEST_BASE, args: { deep } })
    expect(parsed.ok).toBe(false)
  })

  it('enforces the error-payload rules on run.terminal', () => {
    const withoutError = parseCursorProtocolMessage({
      version: V,
      type: 'run.terminal',
      requestId: 'r',
      runId: 'run-1',
      capability: 'cap',
      outcome: 'error',
    })
    expect(withoutError.ok).toBe(false)
    const withError = parseCursorProtocolMessage({
      version: V,
      type: 'run.terminal',
      requestId: 'r',
      runId: 'run-1',
      capability: 'cap',
      outcome: 'completed',
      error: { code: 'late', message: 'should not be here' },
    })
    expect(withError.ok).toBe(false)
  })

  it('enforces the ok/result/error pairing on tool.result', () => {
    const failingWithoutError = parseCursorProtocolMessage({
      version: V,
      type: 'tool.result',
      requestId: 'r',
      runId: 'run-1',
      capability: 'cap',
      ok: false,
    })
    expect(failingWithoutError.ok).toBe(false)
    const okWithError = parseCursorProtocolMessage({
      version: V,
      type: 'tool.result',
      requestId: 'r',
      runId: 'run-1',
      capability: 'cap',
      ok: true,
      error: { code: 'x', message: 'mixed signals' },
    })
    expect(okWithError.ok).toBe(false)
    const failingWithResult = parseCursorProtocolMessage({
      version: V,
      type: 'tool.result',
      requestId: 'r',
      runId: 'run-1',
      capability: 'cap',
      ok: false,
      result: 1,
      error: { code: 'x', message: 'failed' },
    })
    expect(failingWithResult.ok).toBe(false)
  })

  it('enforces the https scheme on auth.result loginUrl', () => {
    const https = parseCursorProtocolMessage({
      version: V,
      type: 'auth.result',
      requestId: 'r',
      state: 'pending',
      loginUrl: 'https://cursor.com/device-login',
    })
    expect(https.ok).toBe(true)
    for (const loginUrl of [
      'http://cursor.com/device-login',
      'file:///etc/passwd',
      'cursor://login',
      'https://', // scheme without a host is not a URL either
    ]) {
      const parsed = parseCursorProtocolMessage({
        version: V,
        type: 'auth.result',
        requestId: 'r',
        state: 'pending',
        loginUrl,
      })
      expect(parsed.ok, `loginUrl ${loginUrl} must be rejected`).toBe(false)
      if (!parsed.ok) expect(parsed.rejection.kind).toBe('invalid-message')
    }
  })

  it('requires an error payload on worker.error and validates its shape', () => {
    const missing = parseCursorProtocolMessage({ version: V, type: 'worker.error' })
    expect(missing.ok).toBe(false)
    const malformed = parseCursorProtocolMessage({
      version: V,
      type: 'worker.error',
      error: { code: '', message: 'empty code', extra: 1 },
    })
    expect(malformed.ok).toBe(false)
  })

  it('rejects unknown enum literals in state, outcome, and event kinds', () => {
    for (const raw of [
      { version: V, type: 'auth.result', requestId: 'r', state: 'maybe' },
      {
        version: V,
        type: 'run.terminal',
        requestId: 'r',
        runId: 'run-1',
        capability: 'cap',
        outcome: 'interrupted',
      },
      {
        version: V,
        type: 'run.event',
        runId: 'run-1',
        capability: 'cap',
        event: { kind: 'delta', text: 't' },
      },
    ]) {
      const parsed = parseCursorProtocolMessage(raw)
      expect(parsed.ok).toBe(false)
      if (!parsed.ok) expect(parsed.rejection.kind).toBe('invalid-message')
    }
  })

  it('rejects oversized prompts beyond the protocol shape limit', () => {
    const parsed = parseCursorProtocolMessage({
      version: V,
      type: 'run.start',
      requestId: 'r',
      runId: 'run-1',
      capability: 'cap',
      prompt: 'x'.repeat(1_000_001),
      modelId: 'grok-4',
      toolNames: [],
    })
    expect(parsed.ok).toBe(false)
  })

  it('requires models to be an array of well-formed summaries', () => {
    const notArray = parseCursorProtocolMessage({
      version: V,
      type: 'models.result',
      requestId: 'r',
      models: { id: 'grok-4' },
    })
    expect(notArray.ok).toBe(false)
    const badEntry = parseCursorProtocolMessage({
      version: V,
      type: 'models.result',
      requestId: 'r',
      models: [{ id: 'grok-4', name: 'Grok 4', surprise: true }],
    })
    expect(badEntry.ok).toBe(false)
  })
})

describe('isJsonValue / isJsonObject', () => {
  it('accepts JSON-representable values', () => {
    expect(isJsonValue('text')).toBe(true)
    expect(isJsonValue(12.5)).toBe(true)
    expect(isJsonValue(false)).toBe(true)
    expect(isJsonValue(null)).toBe(true)
    expect(isJsonValue([1, 'two', [null, { three: true }]])).toBe(true)
    expect(isJsonValue({ a: { b: [1, 2, 3] } })).toBe(true)
    expect(isJsonObject({ slideIndex: 0, nested: { ok: true } })).toBe(true)
  })

  it('rejects non-JSON kinds', () => {
    expect(isJsonValue(Number.NaN)).toBe(false)
    expect(isJsonValue(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isJsonValue(undefined)).toBe(false)
    expect(isJsonValue(() => 'x')).toBe(false)
    expect(isJsonValue(Symbol('s'))).toBe(false)
    expect(isJsonValue(10n)).toBe(false)
    expect(isJsonValue(new Date())).toBe(false)
    expect(isJsonValue(new Map())).toBe(false)
    expect(isJsonValue([1, () => 'x'])).toBe(false)
    expect(isJsonValue({ fn: () => 1 })).toBe(false)
    expect(isJsonObject([1, 2])).toBe(false)
    expect(isJsonObject('text')).toBe(false)
  })
})
