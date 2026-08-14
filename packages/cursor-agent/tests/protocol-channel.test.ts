import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CURSOR_PROTOCOL_VERSION,
  CursorProtocolChannel,
  MAX_REMEMBERED_CLOSED_RUNS,
  type CursorProtocolMessage,
  type CursorChannelRole,
  type ProtocolRejection,
  type RunStartMessage,
  type ToolRequestMessage,
} from '../src/index'

const V = CURSOR_PROTOCOL_VERSION
const CAP = 'cap-1'
const RUN = 'run-1'
/** Minutes-scale run budget; run.start must never inherit the 30s RPC default. */
const RUN_TIMEOUT_MS = 600_000

interface Pair {
  parent: CursorProtocolChannel
  worker: CursorProtocolChannel
  parentReceived: CursorProtocolMessage[]
  workerReceived: CursorProtocolMessage[]
  parentRejections: ProtocolRejection[]
  workerRejections: ProtocolRejection[]
}

/** Loopback wiring: whatever one side sends is delivered to the other. */
function createPair(): Pair {
  const parentReceived: CursorProtocolMessage[] = []
  const workerReceived: CursorProtocolMessage[] = []
  const parentRejections: ProtocolRejection[] = []
  const workerRejections: ProtocolRejection[] = []
  // The worker's send closure runs only after both channels exist, so the
  // forward reference to `parent` is safe.
  const worker = new CursorProtocolChannel({
    role: 'worker',
    send: (message) => parent.receive(message),
    onMessage: (message) => workerReceived.push(message),
    onRejection: (rejection) => workerRejections.push(rejection),
  })
  const parent = new CursorProtocolChannel({
    role: 'parent',
    send: (message) => worker.receive(message),
    onMessage: (message) => parentReceived.push(message),
    onRejection: (rejection) => parentRejections.push(rejection),
  })
  return { parent, worker, parentReceived, workerReceived, parentRejections, workerRejections }
}

function runStart(requestId = 'req-run', runId = RUN, capability = CAP): RunStartMessage {
  return {
    version: V,
    type: 'run.start',
    requestId,
    runId,
    capability,
    prompt: 'Compose a title slide.',
    modelId: 'grok-4',
    toolNames: ['compose_slide'],
  }
}

function toolRequest(requestId = 'req-tool', runId = RUN, capability = CAP): ToolRequestMessage {
  return {
    version: V,
    type: 'tool.request',
    requestId,
    runId,
    capability,
    toolName: 'read_slide',
    args: { slideIndex: 0 },
  }
}

/** A standalone channel with its traffic captured, for one-sided failure modes. */
function createCapture(role: CursorChannelRole = 'worker') {
  const sent: CursorProtocolMessage[] = []
  const received: CursorProtocolMessage[] = []
  const rejections: ProtocolRejection[] = []
  const channel = new CursorProtocolChannel({
    role,
    send: (message) => sent.push(message),
    onMessage: (message) => received.push(message),
    onRejection: (rejection) => rejections.push(rejection),
  })
  return { channel, sent, received, rejections }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CursorProtocolChannel happy paths', () => {
  it('round-trips initialize through ready', async () => {
    const pair = createPair()
    const pending = pair.parent.request({ version: V, type: 'initialize', requestId: 'req-init' })
    expect(pair.workerReceived.map((m) => m.type)).toContain('initialize')
    pair.worker.send({ version: V, type: 'ready', requestId: 'req-init', sdkVersion: '0.1.0' })
    await expect(pending).resolves.toMatchObject({ type: 'ready', sdkVersion: '0.1.0' })
  })

  it('round-trips auth.login, auth.status, and auth.logout through auth.result', async () => {
    const pair = createPair()
    const login = pair.parent.request({ version: V, type: 'auth.login', requestId: 'req-login' })
    pair.worker.send({
      version: V,
      type: 'auth.result',
      requestId: 'req-login',
      state: 'pending',
      loginUrl: 'https://cursor.com/device-login',
    })
    await expect(login).resolves.toMatchObject({ type: 'auth.result', state: 'pending' })

    const status = pair.parent.request({ version: V, type: 'auth.status', requestId: 'req-status' })
    pair.worker.send({
      version: V,
      type: 'auth.result',
      requestId: 'req-status',
      state: 'authenticated',
    })
    await expect(status).resolves.toMatchObject({ state: 'authenticated' })

    const logout = pair.parent.request({ version: V, type: 'auth.logout', requestId: 'req-logout' })
    pair.worker.send({
      version: V,
      type: 'auth.result',
      requestId: 'req-logout',
      state: 'unauthenticated',
    })
    await expect(logout).resolves.toMatchObject({ state: 'unauthenticated' })
  })

  it('rejects a request whose reply carries an error payload', async () => {
    const pair = createPair()
    const pending = pair.parent.request({ version: V, type: 'auth.login', requestId: 'req-login' })
    pair.worker.send({
      version: V,
      type: 'auth.result',
      requestId: 'req-login',
      state: 'unauthenticated',
      error: { code: 'login-denied', message: 'browser login was closed' },
    })
    await expect(pending).rejects.toMatchObject({ code: 'login-denied' })
  })

  it('round-trips models.list through models.result', async () => {
    const pair = createPair()
    const pending = pair.parent.request({
      version: V,
      type: 'models.list',
      requestId: 'req-models',
    })
    pair.worker.send({
      version: V,
      type: 'models.result',
      requestId: 'req-models',
      models: [{ id: 'grok-4', name: 'Grok 4' }],
    })
    await expect(pending).resolves.toMatchObject({
      type: 'models.result',
      models: [{ id: 'grok-4' }],
    })
  })

  it('streams run events and settles run.start on the terminal', async () => {
    const pair = createPair()
    const pending = pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    pair.worker.send({
      version: V,
      type: 'run.event',
      runId: RUN,
      capability: CAP,
      event: { kind: 'text', text: 'Re' },
    })
    pair.worker.send({
      version: V,
      type: 'run.event',
      runId: RUN,
      capability: CAP,
      event: { kind: 'tool-call', toolName: 'read_slide' },
    })
    expect(pair.parentReceived.filter((m) => m.type === 'run.event')).toHaveLength(2)
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-run',
      runId: RUN,
      capability: CAP,
      outcome: 'completed',
    })
    await expect(pending).resolves.toMatchObject({ type: 'run.terminal', outcome: 'completed' })
    expect(pair.parentRejections).toHaveLength(0)
  })

  it('round-trips a custom tool call through the parent', async () => {
    const pair = createPair()
    const run = pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    const tool = pair.worker.request(toolRequest())
    expect(pair.parentReceived.filter((m) => m.type === 'tool.request')).toHaveLength(1)
    pair.parent.send({
      version: V,
      type: 'tool.result',
      requestId: 'req-tool',
      runId: RUN,
      capability: CAP,
      ok: true,
      result: { slideIndex: 0 },
    })
    await expect(tool).resolves.toMatchObject({ type: 'tool.result', ok: true })
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-run',
      runId: RUN,
      capability: CAP,
      outcome: 'completed',
    })
    await expect(run).resolves.toMatchObject({ outcome: 'completed' })
  })

  it('rejects a failed tool result with its error code', async () => {
    const pair = createPair()
    pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    const tool = pair.worker.request(toolRequest())
    pair.parent.send({
      version: V,
      type: 'tool.result',
      requestId: 'req-tool',
      runId: RUN,
      capability: CAP,
      ok: false,
      error: { code: 'stale-session', message: 'deck was closed' },
    })
    await expect(tool).rejects.toMatchObject({ code: 'stale-session' })
  })

  it('delivers plain requests to the receiving side for handling', () => {
    const pair = createPair()
    pair.parent.send({ version: V, type: 'initialize', requestId: 'req-init' })
    pair.parent.send({ version: V, type: 'auth.status', requestId: 'req-status' })
    pair.parent.send({ version: V, type: 'shutdown', requestId: 'req-down' })
    expect(pair.workerReceived.map((m) => m.type)).toEqual([
      'initialize',
      'auth.status',
      'shutdown',
    ])
  })

  it('delivers a received run.start without registering run state', () => {
    const pair = createPair()
    pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    // The worker application adopts the run; the channel itself must not have
    // created parent-style run bookkeeping from wire data (it sends tool
    // traffic through pending-entry binding instead).
    pair.worker.send(toolRequest('req-tool', 'run-other'))
    expect(pair.parentRejections).toContainEqual({
      kind: 'unknown-run',
      runId: 'run-other',
      type: 'tool.request',
    })
  })
})

describe('CursorProtocolChannel direction enforcement', () => {
  it('rejects worker-forged parent-to-worker traffic at the parent without state changes', async () => {
    const pair = createPair()
    const run = pair.parent.request(runStart('req-run', 'run-real'), RUN_TIMEOUT_MS)
    // Forged parent->worker messages arriving over the worker's transport.
    pair.worker.send(runStart('req-forged', 'run-forged'))
    pair.worker.send({
      version: V,
      type: 'run.cancel',
      requestId: 'x',
      runId: 'run-real',
      capability: CAP,
    })
    pair.worker.send({
      version: V,
      type: 'tool.result',
      requestId: 'x',
      runId: 'run-real',
      capability: CAP,
      ok: false,
      error: { code: 'e', message: 'm' },
    })
    expect(pair.parentRejections.filter((r) => r.kind === 'wrong-direction')).toHaveLength(3)
    // The forged run.start must not have registered any parent run state.
    pair.worker.send({
      version: V,
      type: 'run.event',
      runId: 'run-forged',
      capability: CAP,
      event: { kind: 'text', text: 'owned' },
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'unknown-run',
      runId: 'run-forged',
      type: 'run.event',
    })
    // And the real run is untouched: it still settles normally.
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-run',
      runId: 'run-real',
      capability: CAP,
      outcome: 'completed',
    })
    await expect(run).resolves.toMatchObject({ outcome: 'completed' })
  })

  it('rejects wire-side worker-to-parent traffic at the worker', () => {
    const pair = createPair()
    pair.parent.send({ version: V, type: 'ready', requestId: 'r' })
    pair.parent.send({
      version: V,
      type: 'run.event',
      runId: RUN,
      capability: CAP,
      event: { kind: 'text', text: 'x' },
    })
    pair.parent.send(toolRequest())
    expect(pair.workerRejections.filter((r) => r.kind === 'wrong-direction')).toHaveLength(3)
    expect(pair.workerReceived).toHaveLength(0)
  })
})

describe('CursorProtocolChannel rejection rules', () => {
  it('rejects replies with an unknown request id', () => {
    const pair = createPair()
    pair.worker.send({
      version: V,
      type: 'auth.result',
      requestId: 'ghost',
      state: 'authenticated',
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'unknown-request-id',
      requestId: 'ghost',
      type: 'auth.result',
    })
  })

  it('rejects a reply of the wrong type for a pending request', () => {
    const pair = createPair()
    pair.parent.request({ version: V, type: 'models.list', requestId: 'req-models' })
    pair.worker.send({ version: V, type: 'ready', requestId: 'req-models' })
    const mismatch = pair.parentRejections.find((r) => r.kind === 'invalid-message')
    expect(mismatch).toBeDefined()
    expect(mismatch && mismatch.kind === 'invalid-message' ? mismatch.type : undefined).toBe(
      'ready',
    )
  })

  it('binds run.terminal to its own run.start promise', async () => {
    const pair = createPair()
    const first = pair.parent.request(runStart('req-a', 'run-a', 'cap-a'), RUN_TIMEOUT_MS)
    const second = pair.parent.request(runStart('req-b', 'run-b', 'cap-b'), RUN_TIMEOUT_MS)
    // A terminal echoing run-a's request id but run-b's identity must not
    // settle either promise.
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-a',
      runId: 'run-b',
      capability: 'cap-b',
      outcome: 'completed',
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'run-mismatch',
      requestId: 'req-a',
      type: 'run.terminal',
      runId: 'run-b',
    })
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-a',
      runId: 'run-a',
      capability: 'cap-a',
      outcome: 'completed',
    })
    await expect(first).resolves.toMatchObject({ outcome: 'completed' })
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-b',
      runId: 'run-b',
      capability: 'cap-b',
      outcome: 'completed',
    })
    await expect(second).resolves.toMatchObject({ outcome: 'completed' })
  })

  it('binds tool results to their pending tool request', async () => {
    const pair = createPair()
    pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    const tool = pair.worker.request(toolRequest())
    pair.parent.send({
      version: V,
      type: 'tool.result',
      requestId: 'req-tool',
      runId: 'run-other',
      capability: CAP,
      ok: true,
      result: null,
    })
    expect(pair.workerRejections).toContainEqual({
      kind: 'run-mismatch',
      requestId: 'req-tool',
      type: 'tool.result',
      runId: 'run-other',
    })
    pair.parent.send({
      version: V,
      type: 'tool.result',
      requestId: 'req-tool',
      runId: RUN,
      capability: CAP,
      ok: true,
      result: { slideIndex: 0 },
    })
    await expect(tool).resolves.toMatchObject({ ok: true })
  })

  it('rejects a duplicate terminal for one run id', async () => {
    const pair = createPair()
    const pending = pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-run',
      runId: RUN,
      capability: CAP,
      outcome: 'completed',
    })
    await expect(pending).resolves.toMatchObject({ outcome: 'completed' })
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-run-2',
      runId: RUN,
      capability: CAP,
      outcome: 'completed',
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'duplicate-terminal',
      runId: RUN,
      type: 'run.terminal',
    })
  })

  it('rejects late run events after the terminal', async () => {
    const pair = createPair()
    const pending = pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-run',
      runId: RUN,
      capability: CAP,
      outcome: 'completed',
    })
    await expect(pending).resolves.toMatchObject({ outcome: 'completed' })
    pair.worker.send({
      version: V,
      type: 'run.event',
      runId: RUN,
      capability: CAP,
      event: { kind: 'text', text: 'too late' },
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'late-message',
      runId: RUN,
      type: 'run.event',
    })
  })

  it('rejects tool traffic for an unknown run id or wrong capability', () => {
    const pair = createPair()
    pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    pair.worker.send(toolRequest('req-tool', 'run-unknown'))
    pair.worker.send(toolRequest('req-tool', RUN, 'cap-forged'))
    expect(pair.parentRejections).toContainEqual({
      kind: 'unknown-run',
      runId: 'run-unknown',
      type: 'tool.request',
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'capability-mismatch',
      runId: RUN,
      type: 'tool.request',
    })
    expect(pair.parentReceived.filter((m) => m.type === 'tool.request')).toHaveLength(0)
  })

  it('rejects a duplicate tool request id within one run', () => {
    const pair = createPair()
    pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    pair.worker.send(toolRequest('req-tool'))
    pair.worker.send(toolRequest('req-tool'))
    expect(pair.parentReceived.filter((m) => m.type === 'tool.request')).toHaveLength(1)
    expect(pair.parentRejections).toContainEqual({
      kind: 'duplicate-tool-request',
      requestId: 'req-tool',
      runId: RUN,
      type: 'tool.request',
    })
  })

  it('rejects tool requests and results after cancellation', async () => {
    const pair = createPair()
    const run = pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    const tool = pair.worker.request(toolRequest())
    pair.parent.send({
      version: V,
      type: 'run.cancel',
      requestId: 'req-cancel',
      runId: RUN,
      capability: CAP,
    })
    await expect(tool).rejects.toMatchObject({ code: 'run-cancelled' })
    pair.parent.send({
      version: V,
      type: 'tool.result',
      requestId: 'req-tool',
      runId: RUN,
      capability: CAP,
      ok: true,
      result: null,
    })
    expect(pair.workerRejections).toContainEqual({
      kind: 'late-message',
      runId: RUN,
      type: 'tool.result',
    })
    // The cancel does not eat the terminal: the run promise still settles.
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-run',
      runId: RUN,
      capability: CAP,
      outcome: 'cancelled',
    })
    await expect(run).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('cancels a run locally and still settles on the terminal', async () => {
    const pair = createPair()
    const run = pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    expect(pair.parent.cancelRun(RUN)).toBe(true)
    expect(pair.parent.cancelRun(RUN)).toBe(false)
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-run',
      runId: RUN,
      capability: CAP,
      outcome: 'cancelled',
    })
    await expect(run).rejects.toMatchObject({ code: 'cancelled' })
  })

  it('rejects late tool results after the run terminal', async () => {
    const pair = createPair()
    pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    const tool = pair.worker.request(toolRequest())
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-run',
      runId: RUN,
      capability: CAP,
      outcome: 'completed',
    })
    await expect(tool).rejects.toMatchObject({ code: 'run-terminal' })
    pair.parent.send({
      version: V,
      type: 'tool.result',
      requestId: 'req-tool',
      runId: RUN,
      capability: CAP,
      ok: true,
      result: null,
    })
    expect(pair.workerRejections).toContainEqual({
      kind: 'late-message',
      runId: RUN,
      type: 'tool.result',
    })
  })

  it('rejects run-id reuse on request even after the run ended', async () => {
    const pair = createPair()
    const first = pair.parent.request(runStart('req-1', 'run-once'), RUN_TIMEOUT_MS)
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-1',
      runId: 'run-once',
      capability: CAP,
      outcome: 'completed',
    })
    await expect(first).resolves.toMatchObject({ outcome: 'completed' })
    await expect(
      pair.parent.request(runStart('req-2', 'run-once'), RUN_TIMEOUT_MS),
    ).rejects.toMatchObject({
      code: 'duplicate-run',
    })
    // While a run is active, reuse is rejected as well.
    const live = pair.parent.request(runStart('req-3', 'run-live'), RUN_TIMEOUT_MS)
    await expect(
      pair.parent.request(runStart('req-4', 'run-live'), RUN_TIMEOUT_MS),
    ).rejects.toMatchObject({
      code: 'duplicate-run',
    })
    pair.worker.send({
      version: V,
      type: 'run.terminal',
      requestId: 'req-3',
      runId: 'run-live',
      capability: CAP,
      outcome: 'completed',
    })
    await expect(live).resolves.toMatchObject({ outcome: 'completed' })
  })

  it('rejects duplicate pending request ids', async () => {
    const pair = createPair()
    pair.parent.request({ version: V, type: 'initialize', requestId: 'req-same' })
    await expect(
      pair.parent.request({ version: V, type: 'auth.login', requestId: 'req-same' }),
    ).rejects.toMatchObject({ code: 'duplicate-request' })
  })

  it('rejects invalid or unknown messages without throwing', () => {
    const { channel, rejections } = createCapture('parent')
    channel.receive({ version: 99, type: 'initialize', requestId: 'r' })
    channel.receive({ version: V, type: 'not-a-type', requestId: 'r' })
    channel.receive('garbage')
    expect(rejections.map((r) => r.kind)).toEqual([
      'invalid-version',
      'unknown-type',
      'invalid-message',
    ])
  })

  it('rejects request() for message types that expect no reply', async () => {
    const pair = createPair()
    await expect(
      pair.parent.request({
        version: V,
        type: 'run.cancel',
        requestId: 'r',
        runId: RUN,
        capability: CAP,
      }),
    ).rejects.toMatchObject({ code: 'no-reply-expected' })
  })
})

describe('CursorProtocolChannel timeouts and worker exit', () => {
  it('requires an explicit timeout for run.start and does not start the run', async () => {
    const pair = createPair()
    // Simulate a JS caller ignoring the required parameter.
    const loose = pair.parent.request.bind(pair.parent) as unknown as (
      message: CursorProtocolMessage,
      timeoutMs?: number,
    ) => Promise<CursorProtocolMessage>
    await expect(loose(runStart())).rejects.toMatchObject({ code: 'timeout-required' })
    expect(pair.workerReceived).toHaveLength(0)
    // The rejected start left no run state behind.
    pair.worker.send({
      version: V,
      type: 'run.event',
      runId: RUN,
      capability: CAP,
      event: { kind: 'text', text: 'x' },
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'unknown-run',
      runId: RUN,
      type: 'run.event',
    })
  })

  it('clears pending promises on timeout, flags recycle, and rejects late replies', async () => {
    const { channel, rejections } = createCapture('parent')
    const pending = channel.request(
      { version: V, type: 'initialize', requestId: 'req-init' },
      1_000,
    )
    vi.advanceTimersByTime(1_000)
    await expect(pending).rejects.toMatchObject({ code: 'timeout' })
    expect(channel.needsRecycle).toBe(true)
    // The pending entry is gone: the same reply is now an unknown id.
    channel.receive({ version: V, type: 'ready', requestId: 'req-init' })
    expect(rejections).toContainEqual({
      kind: 'unknown-request-id',
      requestId: 'req-init',
      type: 'ready',
    })
  })

  it('times out a tool request and rejects the late result', async () => {
    const { channel, rejections } = createCapture('worker')
    channel.receive(runStart())
    const tool = channel.request(toolRequest(), 2_000)
    vi.advanceTimersByTime(2_000)
    await expect(tool).rejects.toMatchObject({ code: 'timeout' })
    channel.receive({
      version: V,
      type: 'tool.result',
      requestId: 'req-tool',
      runId: RUN,
      capability: CAP,
      ok: true,
      result: null,
    })
    expect(rejections).toContainEqual({
      kind: 'unknown-request-id',
      requestId: 'req-tool',
      type: 'tool.result',
    })
  })

  it('closes the run when run.start times out', async () => {
    const pair = createPair()
    const run = pair.parent.request(runStart(), 5_000)
    vi.advanceTimersByTime(5_000)
    await expect(run).rejects.toMatchObject({ code: 'timeout' })
    pair.worker.send(toolRequest('req-tool'))
    expect(pair.parentRejections).toContainEqual({
      kind: 'late-message',
      runId: RUN,
      type: 'tool.request',
    })
  })

  it('cleans up the pending entry when the transport sink throws', async () => {
    const rejections: ProtocolRejection[] = []
    let failNextSend = true
    const channel = new CursorProtocolChannel({
      role: 'parent',
      send: () => {
        if (failNextSend) {
          failNextSend = false
          throw new Error('transport is gone')
        }
      },
      onRejection: (rejection) => rejections.push(rejection),
    })
    await expect(
      channel.request({ version: V, type: 'initialize', requestId: 'req-init' }),
    ).rejects.toThrow('transport is gone')
    // No orphaned timer fired and the channel is not flagged for recycle.
    vi.advanceTimersByTime(60_000)
    expect(channel.needsRecycle).toBe(false)
    expect(rejections).toHaveLength(0)
    // The request id was released and can be retried.
    const retry = channel.request({ version: V, type: 'initialize', requestId: 'req-init' })
    channel.receive({ version: V, type: 'ready', requestId: 'req-init' })
    await expect(retry).resolves.toMatchObject({ type: 'ready' })
  })

  it('rejects every pending request when the worker exits', async () => {
    const pair = createPair()
    const init = pair.parent.request({ version: V, type: 'initialize', requestId: 'req-init' })
    const models = pair.parent.request({ version: V, type: 'models.list', requestId: 'req-models' })
    pair.parent.terminate('worker exited unexpectedly')
    await expect(init).rejects.toMatchObject({ code: 'channel-closed' })
    await expect(models).rejects.toMatchObject({ code: 'channel-closed' })
    expect(pair.parent.needsRecycle).toBe(true)
    // Post-exit traffic is refused in both directions.
    pair.worker.send({ version: V, type: 'ready', requestId: 'req-init' })
    const workerCount = pair.workerReceived.length
    pair.parent.send({ version: V, type: 'shutdown', requestId: 'req-down' })
    expect(pair.parentRejections).toContainEqual({ kind: 'closed-channel' })
    expect(pair.workerReceived).toHaveLength(workerCount)
    await expect(
      pair.parent.request({ version: V, type: 'initialize', requestId: 'req-after' }),
    ).rejects.toMatchObject({ code: 'channel-closed' })
  })

  it('rejects the pending request targeted by worker.error', async () => {
    const pair = createPair()
    const pending = pair.parent.request({
      version: V,
      type: 'models.list',
      requestId: 'req-models',
    })
    pair.worker.send({
      version: V,
      type: 'worker.error',
      requestId: 'req-models',
      error: { code: 'sdk-crash', message: 'agent crashed' },
    })
    await expect(pending).rejects.toMatchObject({ code: 'sdk-crash' })
  })

  it('closes the run when worker.error kills its run.start', async () => {
    const pair = createPair()
    const run = pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    pair.worker.send({
      version: V,
      type: 'worker.error',
      requestId: 'req-run',
      error: { code: 'sdk-crash', message: 'agent crashed' },
    })
    await expect(run).rejects.toMatchObject({ code: 'sdk-crash' })
    // The run must not stay live: later tool traffic for it is late.
    pair.worker.send(toolRequest('req-tool'))
    expect(pair.parentRejections).toContainEqual({
      kind: 'late-message',
      runId: RUN,
      type: 'tool.request',
    })
  })

  it('closes the run named by a run-scoped worker.error and reports it', () => {
    const pair = createPair()
    pair.parent.request(runStart(), RUN_TIMEOUT_MS)
    pair.worker.send({
      version: V,
      type: 'worker.error',
      runId: RUN,
      error: { code: 'stream-lost', message: 'eof' },
    })
    expect(pair.parentReceived.filter((m) => m.type === 'worker.error')).toHaveLength(1)
    pair.worker.send({
      version: V,
      type: 'run.event',
      runId: RUN,
      capability: CAP,
      event: { kind: 'text', text: 'too late' },
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'late-message',
      runId: RUN,
      type: 'run.event',
    })
  })

  it('rejects worker.error aimed at an unknown request id and delivers run-less reports', () => {
    const pair = createPair()
    pair.worker.send({
      version: V,
      type: 'worker.error',
      requestId: 'ghost',
      error: { code: 'sdk-crash', message: 'agent crashed' },
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'unknown-request-id',
      requestId: 'ghost',
      type: 'worker.error',
    })
    pair.worker.send({
      version: V,
      type: 'worker.error',
      error: { code: 'boot-failed', message: 'no helper' },
    })
    expect(pair.parentReceived.filter((m) => m.type === 'worker.error')).toHaveLength(1)
  })

  it('remembers only a bounded window of finished runs', async () => {
    const pair = createPair()
    const total = MAX_REMEMBERED_CLOSED_RUNS + 1
    for (let i = 0; i < total; i++) {
      const runId = `run-${i}`
      const capability = `cap-${i}`
      const pending = pair.parent.request(runStart(`req-${i}`, runId, capability), RUN_TIMEOUT_MS)
      pair.worker.send({
        version: V,
        type: 'run.terminal',
        requestId: `req-${i}`,
        runId,
        capability,
        outcome: 'completed',
      })
      await expect(pending).resolves.toMatchObject({ outcome: 'completed' })
    }
    // The oldest finished run fell out of the window: unknown, still rejected.
    pair.worker.send({
      version: V,
      type: 'run.event',
      runId: 'run-0',
      capability: 'cap-0',
      event: { kind: 'text', text: 'late' },
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'unknown-run',
      runId: 'run-0',
      type: 'run.event',
    })
    // The most recent finished run is still classified as late.
    const last = `run-${total - 1}`
    pair.worker.send({
      version: V,
      type: 'run.event',
      runId: last,
      capability: `cap-${total - 1}`,
      event: { kind: 'text', text: 'late' },
    })
    expect(pair.parentRejections).toContainEqual({
      kind: 'late-message',
      runId: last,
      type: 'run.event',
    })
  })
})
