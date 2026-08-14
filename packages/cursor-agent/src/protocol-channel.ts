/**
 * Transport-agnostic correlation runtime for the Cursor parent/worker
 * protocol. One instance serves one side of the wire and declares that side
 * via `role`: the Electron main process uses a 'parent' channel for
 * parent-to-worker requests (`initialize`, `auth.*`, `models.list`,
 * `run.start`) and the worker uses a 'worker' channel for its `tool.request`
 * calls. The caller owns the actual transport (utility-process port, stdio,
 * test loopback); this module only validates, correlates, times out, and
 * rejects.
 *
 * Enforcement summary (docs/cursor/ARCHITECTURE.md):
 * - direction: a message whose type belongs to the receiving side's own
 *   direction can only be forged and is rejected without any state change —
 *   in particular the parent never registers run state from a wire-side
 *   `run.start`; runs exist only through the local `request(run.start)`;
 * - a reply settles exactly one pending request id, bound to its own run id
 *   and capability; unknown ids and cross-run swaps are rejected;
 * - each run id accepts exactly one `run.terminal`; duplicates are rejected;
 * - run/tool traffic carries a capability that must match the run's minted
 *   capability, so stale or retargeted messages after cancellation, worker
 *   restart, or tab switches fail closed;
 * - messages for a run that already terminated, was cancelled, or timed out
 *   are rejected as late; a bounded window of finished run ids is remembered
 *   for that classification, older ids are reported as unknown;
 * - within one run, each `tool.request` request id is delivered once;
 * - a per-request timeout clears its pending promise and flags the channel as
 *   needing worker termination or recycling (the caller performs it);
 * - `terminate()` is the worker-exit hook: it rejects everything pending.
 */

import {
  EXPECTED_REPLY_TYPE,
  isParentToWorkerType,
  isWorkerToParentType,
  parseCursorProtocolMessage,
  type AuthLoginMessage,
  type AuthLogoutMessage,
  type AuthResultMessage,
  type AuthStatusMessage,
  type CursorProtocolMessage,
  type InitializeMessage,
  type ModelsListMessage,
  type ModelsResultMessage,
  type ProtocolRejection,
  type ReadyMessage,
  type RunStartMessage,
  type RunTerminalMessage,
  type ToolRequestMessage,
  type ToolResultMessage,
  type WorkerErrorMessage,
} from './protocol'

export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

/**
 * How many recently finished run ids stay classified as "late" before the
 * oldest is evicted (and becomes plain `unknown-run` again). Bounds channel
 * memory for long-lived workers; a reuse of an evicted run id is not treated
 * as a collision.
 */
export const MAX_REMEMBERED_CLOSED_RUNS = 128

/** Rejection carried by promise failures; `code` is stable for callers to branch on. */
export class CursorProtocolError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CursorProtocolError'
    this.code = code
  }
}

/** Which side of the wire this channel represents. */
export type CursorChannelRole = 'parent' | 'worker'

export interface CursorChannelOptions {
  readonly role: CursorChannelRole
  /** Transport sink for outgoing messages; never called after `terminate()`. */
  readonly send: (message: CursorProtocolMessage) => void
  /** Validated messages that need application handling (requests received from
   * the other side, run events, tool requests, unmatched worker errors). */
  readonly onMessage?: (message: CursorProtocolMessage) => void
  /** Every refused message or local failure (invalid, unknown, late, duplicate,
   * wrong direction, timeout, closed). */
  readonly onRejection?: (rejection: ProtocolRejection) => void
  readonly defaultTimeoutMs?: number
}

interface PendingEntry {
  readonly requestType: string
  readonly expectedReply: string
  readonly runId: string | null
  readonly capability: string | null
  readonly resolve: (message: CursorProtocolMessage) => void
  readonly reject: (error: Error) => void
  readonly timer: ReturnType<typeof setTimeout>
}

/** A run started locally via `request(run.start)`. Exists only on the parent. */
interface ActiveRun {
  /** Opaque capability minted by the parent when the run started. */
  readonly capability: string
  /** Cancellation seen: no new tool traffic, but the terminal reply is still accepted. */
  cancelled: boolean
  /** tool.request ids already delivered for this run (duplicate defense). */
  readonly toolRequestIds: Set<string>
}

/** Every message that carries a request id (all except `run.event`). */
type RequestCarryingMessage = Extract<CursorProtocolMessage, { requestId: string }>

export class CursorProtocolChannel {
  private readonly pending = new Map<string, PendingEntry>()
  /** Locally started, not-yet-terminal runs. Parent side only by construction. */
  private readonly activeRuns = new Map<string, ActiveRun>()
  /** Bounded FIFO of recently terminalled/cancelled run ids (late-message classification). */
  private readonly closedRuns = new Set<string>()
  private readonly closedRunOrder: string[] = []
  private closed = false
  private recycleRequired = false

  constructor(private readonly options: CursorChannelOptions) {}

  /** True once a request timed out or the channel terminated; the caller must
   * terminate or recycle the worker before sending anything else. */
  get needsRecycle(): boolean {
    return this.recycleRequired
  }

  /**
   * Send a request and await its mapped reply.
   *
   * `run.start` REQUIRES an explicit `timeoutMs` (runs are minutes-scale; the
   * 30s RPC default would kill every run) — omitting it rejects with code
   * `timeout-required` and does not start the run. Simple RPC types fall back
   * to `defaultTimeoutMs` / `DEFAULT_REQUEST_TIMEOUT_MS`.
   */
  request(message: InitializeMessage, timeoutMs?: number): Promise<ReadyMessage>
  request(
    message: AuthLoginMessage | AuthStatusMessage | AuthLogoutMessage,
    timeoutMs?: number,
  ): Promise<AuthResultMessage>
  request(message: ModelsListMessage, timeoutMs?: number): Promise<ModelsResultMessage>
  request(message: RunStartMessage, timeoutMs: number): Promise<RunTerminalMessage>
  request(message: ToolRequestMessage, timeoutMs?: number): Promise<ToolResultMessage>
  request(message: RequestCarryingMessage, timeoutMs?: number): Promise<CursorProtocolMessage>
  request(message: RequestCarryingMessage, timeoutMs?: number): Promise<CursorProtocolMessage> {
    const expectedReply = EXPECTED_REPLY_TYPE[message.type]
    if (!expectedReply) {
      return Promise.reject(
        new CursorProtocolError(
          'no-reply-expected',
          `message type "${message.type}" expects no reply; use send() instead`,
        ),
      )
    }
    if (this.closed) {
      return Promise.reject(
        new CursorProtocolError('channel-closed', 'cursor protocol channel is closed'),
      )
    }
    if (message.type === 'run.start') {
      if (timeoutMs === undefined || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        return Promise.reject(
          new CursorProtocolError(
            'timeout-required',
            'run.start requires an explicit positive timeoutMs (runs outlive the RPC default)',
          ),
        )
      }
      // Run ids are never reused while remembered: re-sending a run id that is
      // active or recently finished is rejected on both request() and send().
      if (this.activeRuns.has(message.runId) || this.closedRuns.has(message.runId)) {
        return Promise.reject(
          new CursorProtocolError('duplicate-run', `run id "${message.runId}" was already used`),
        )
      }
    }
    if (this.pending.has(message.requestId)) {
      return Promise.reject(
        new CursorProtocolError(
          'duplicate-request',
          `request id "${message.requestId}" is already pending`,
        ),
      )
    }
    const timeout = timeoutMs ?? this.options.defaultTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    return new Promise<CursorProtocolMessage>((resolve, reject) => {
      const timer = setTimeout(
        () => this.handleTimeout(message.requestId, message.type, timeout),
        timeout,
      )
      this.pending.set(message.requestId, {
        requestType: message.type,
        expectedReply,
        runId: 'runId' in message && message.runId !== undefined ? message.runId : null,
        capability:
          'capability' in message && message.capability !== undefined ? message.capability : null,
        resolve,
        reject,
        timer,
      })
      try {
        this.send(message)
      } catch (error) {
        // A throwing transport must not orphan the pending entry (its timer
        // would later fire a spurious timeout and poison the recycle flag).
        clearTimeout(timer)
        this.pending.delete(message.requestId)
        throw error
      }
    })
  }

  /** Send a fire-and-forget or reply message (run.cancel, shutdown, tool.result,
   * run.event, run.terminal, ...). Also applies the sender-side run state
   * transitions so a worker that already reported its terminal rejects a late
   * tool result with the same rule the parent applies. Refused with
   * `closed-channel` after `terminate()`. */
  send(message: CursorProtocolMessage): void {
    if (this.closed) {
      this.options.onRejection?.({ kind: 'closed-channel' })
      return
    }
    this.trackOutgoingRun(message)
    this.options.send(message)
  }

  /** Ingest one raw message from the other side. Validates first — including
   * that the message type belongs on THIS side of the wire; invalid or
   * forged messages are reported via onRejection and dropped without any
   * state change. */
  receive(raw: unknown): void {
    if (this.closed) {
      this.options.onRejection?.({ kind: 'closed-channel' })
      return
    }
    const parsed = parseCursorProtocolMessage(raw)
    if (!parsed.ok) {
      this.options.onRejection?.(parsed.rejection)
      return
    }
    const message = parsed.message
    // Direction: the peer must never send this side's own message types. A
    // parent-to-worker type arriving at the parent (e.g. a forged run.start)
    // can only be an attempt to mutate parent-owned run state.
    const fromOwnDirection =
      this.options.role === 'parent'
        ? isParentToWorkerType(message.type)
        : isWorkerToParentType(message.type)
    if (fromOwnDirection) {
      this.options.onRejection?.({ kind: 'wrong-direction', type: message.type })
      return
    }
    switch (message.type) {
      case 'ready':
      case 'auth.result':
      case 'models.result':
        this.settleReply(message.requestId, message.type, (entry) => {
          const settled = this.replyValue(message)
          if (settled instanceof CursorProtocolError) {
            entry.reject(settled)
            return
          }
          entry.resolve(settled)
        })
        return
      case 'run.terminal':
        this.handleTerminal(message)
        return
      case 'run.event': {
        const rejection = this.checkRunMessage(message.runId, message.capability, message.type)
        if (rejection) {
          this.options.onRejection?.(rejection)
          return
        }
        this.options.onMessage?.(message)
        return
      }
      case 'tool.request': {
        const rejection = this.checkRunMessage(message.runId, message.capability, message.type)
        if (rejection) {
          this.options.onRejection?.(rejection)
          return
        }
        const run = this.activeRuns.get(message.runId)
        if (!run) return
        if (run.toolRequestIds.has(message.requestId)) {
          this.options.onRejection?.({
            kind: 'duplicate-tool-request',
            requestId: message.requestId,
            runId: message.runId,
            type: message.type,
          })
          return
        }
        run.toolRequestIds.add(message.requestId)
        this.options.onMessage?.(message)
        return
      }
      case 'tool.result': {
        // Worker side: bind the result to its pending tool.request (run id and
        // capability), not to any run bookkeeping — the worker never tracks
        // parent-owned run state from the wire.
        if (this.closedRuns.has(message.runId)) {
          this.options.onRejection?.({
            kind: 'late-message',
            runId: message.runId,
            type: message.type,
          })
          return
        }
        this.settleReply(
          message.requestId,
          message.type,
          (entry) => {
            if (message.ok) {
              entry.resolve(message)
              return
            }
            const error = message.error
            entry.reject(
              new CursorProtocolError(
                error?.code ?? 'tool-failed',
                error?.message ?? `cursor tool "${entry.requestType}" failed`,
              ),
            )
          },
          { runId: message.runId, capability: message.capability },
        )
        return
      }
      case 'run.start':
        // Worker side: delivered for handling, but NEVER registered here —
        // run state on a channel changes only through local request()/send().
        this.options.onMessage?.(message)
        return
      case 'run.cancel': {
        // Worker side: treat the run as closed for tool traffic and clear the
        // pending tool requests; the app cancels the SDK run. The terminal
        // reply is still sent afterwards.
        this.rememberClosedRun(message.runId)
        this.clearRunPendings(
          message.runId,
          'run-cancelled',
          `cursor run "${message.runId}" was cancelled`,
          ['tool.request'],
        )
        this.options.onMessage?.(message)
        return
      }
      case 'worker.error':
        this.handleWorkerError(message)
        return
      default:
        // initialize, auth.login/auth.status/auth.logout, models.list, shutdown:
        // plain requests the receiving side must answer via send().
        this.options.onMessage?.(message)
        return
    }
  }

  /**
   * Locally cancel a run: clears its pending `tool.request` promises so late
   * tool activity cannot outlive the cancellation. The `run.start` promise is
   * left to settle on the arriving `run.terminal` (or its timeout). Returns
   * false when the run id is unknown or already finished.
   */
  cancelRun(runId: string): boolean {
    const run = this.activeRuns.get(runId)
    if (!run || run.cancelled) return false
    run.cancelled = true
    this.clearRunPendings(runId, 'run-cancelled', `cursor run "${runId}" was cancelled`, [
      'tool.request',
    ])
    return true
  }

  /** Worker-exit / transport-death hook: reject everything pending and close
   * the channel. Later receive()/send() calls report `closed-channel`. */
  terminate(reason = 'cursor worker exited'): void {
    if (this.closed) return
    this.closed = true
    this.recycleRequired = true
    for (const [requestId, entry] of this.pending) {
      clearTimeout(entry.timer)
      this.pending.delete(requestId)
      entry.reject(new CursorProtocolError('channel-closed', reason))
    }
    this.activeRuns.clear()
    this.closedRuns.clear()
    this.closedRunOrder.length = 0
  }

  // -----------------------------------------------------------------------
  // internals
  // -----------------------------------------------------------------------

  private trackOutgoingRun(message: CursorProtocolMessage): void {
    if (message.type === 'run.start') {
      if (this.activeRuns.has(message.runId) || this.closedRuns.has(message.runId)) {
        throw new Error(`cursor run id "${message.runId}" was already used`)
      }
      this.activeRuns.set(message.runId, {
        capability: message.capability,
        cancelled: false,
        toolRequestIds: new Set(),
      })
      return
    }
    if (message.type === 'run.terminal') {
      // Sender-side transition (worker): after reporting the terminal, this
      // side treats its own pending tool requests as dead and later tool
      // results for the run as late.
      this.rememberClosedRun(message.runId)
      this.clearRunPendings(message.runId, 'run-terminal', `cursor run "${message.runId}" ended`, [
        'tool.request',
      ])
      return
    }
    if (message.type === 'run.cancel') {
      // Sender-side transition (parent): the run stays active so the terminal
      // reply can still settle the pending run.start.
      const run = this.activeRuns.get(message.runId)
      if (run && !run.cancelled) {
        run.cancelled = true
        this.clearRunPendings(
          message.runId,
          'run-cancelled',
          `cursor run "${message.runId}" was cancelled`,
          ['tool.request'],
        )
      }
    }
  }

  /** Parent-side run validation for inbound run.event / run.terminal / tool.request. */
  private checkRunMessage(
    runId: string,
    capability: string,
    type: string,
  ): ProtocolRejection | null {
    const run = this.activeRuns.get(runId)
    if (run) {
      if (run.capability !== capability) return { kind: 'capability-mismatch', runId, type }
      if (run.cancelled && type !== 'run.terminal') {
        return { kind: 'late-message', runId, type }
      }
      return null
    }
    if (this.closedRuns.has(runId)) {
      // A terminal already closed this run; anything else is late, and a
      // second terminal is a protocol violation of its own.
      return type === 'run.terminal'
        ? { kind: 'duplicate-terminal', runId, type }
        : { kind: 'late-message', runId, type }
    }
    return { kind: 'unknown-run', runId, type }
  }

  private handleTerminal(message: RunTerminalMessage): void {
    const rejection = this.checkRunMessage(message.runId, message.capability, message.type)
    if (rejection) {
      this.options.onRejection?.(rejection)
      return
    }
    // A terminal must address its own run.start. Check the pending entry
    // BEFORE mutating run state: a cross-run swap (or a terminal echoing some
    // other request's id) is rejected with no state change, so the run it
    // named stays live for its real terminal.
    const entry = this.pending.get(message.requestId)
    if (entry !== undefined && entry.expectedReply !== 'run.terminal') {
      this.options.onRejection?.({
        kind: 'invalid-message',
        type: message.type,
        detail: `expected "${entry.expectedReply}" reply for "${entry.requestType}" request`,
      })
      return
    }
    if (entry !== undefined && entry.runId !== message.runId) {
      this.options.onRejection?.({
        kind: 'run-mismatch',
        requestId: message.requestId,
        type: message.type,
        runId: message.runId,
      })
      return
    }
    this.closeRun(message.runId, 'run-terminal', `cursor run "${message.runId}" ended`)
    // Settle the pending run.start (by echoed request id, bound to this run),
    // then clear any leftover tool traffic for the run.
    this.settleReply(
      message.requestId,
      message.type,
      (entry) => {
        if (message.outcome === 'completed') {
          entry.resolve(message)
          return
        }
        if (message.outcome === 'cancelled') {
          entry.reject(
            new CursorProtocolError('cancelled', `cursor run "${message.runId}" was cancelled`),
          )
          return
        }
        const error = message.error
        entry.reject(
          new CursorProtocolError(
            error?.code ?? 'run-failed',
            error?.message ?? `cursor run "${message.runId}" failed`,
          ),
        )
      },
      { runId: message.runId, capability: message.capability },
    )
    this.clearRunPendings(message.runId, 'run-terminal', `cursor run "${message.runId}" ended`, [
      'tool.request',
    ])
  }

  private handleWorkerError(message: WorkerErrorMessage): void {
    let settledPending = false
    if (message.requestId !== undefined) {
      const entry = this.pending.get(message.requestId)
      if (!entry) {
        this.options.onRejection?.({
          kind: 'unknown-request-id',
          requestId: message.requestId,
          type: message.type,
        })
        return
      }
      clearTimeout(entry.timer)
      this.pending.delete(message.requestId)
      entry.reject(new CursorProtocolError(message.error.code, message.error.message))
      settledPending = true
      // A worker error that kills a run.start means the run can never produce
      // its terminal or tool traffic: close it so later run messages for it
      // are rejected as late instead of staying live forever.
      if (entry.requestType === 'run.start' && entry.runId !== null) {
        this.closeRun(
          entry.runId,
          'worker-error',
          `cursor run "${entry.runId}" failed with a worker error`,
        )
      }
    }
    if (message.runId !== undefined) {
      // No-op for unknown or already-closed runs.
      this.closeRun(
        message.runId,
        'worker-error',
        `cursor run "${message.runId}" failed with a worker error`,
      )
    }
    if (!settledPending) this.options.onMessage?.(message)
  }

  /** Move an active run to the bounded closed-run window and kill its pending tool traffic. */
  private closeRun(runId: string, code: string, reason: string): void {
    if (!this.activeRuns.has(runId)) return
    this.activeRuns.delete(runId)
    this.rememberClosedRun(runId)
    this.clearRunPendings(runId, code, reason, ['tool.request'])
  }

  private rememberClosedRun(runId: string): void {
    if (this.closedRuns.has(runId)) return
    this.closedRuns.add(runId)
    this.closedRunOrder.push(runId)
    if (this.closedRunOrder.length > MAX_REMEMBERED_CLOSED_RUNS) {
      const evicted = this.closedRunOrder.shift()
      if (evicted !== undefined) this.closedRuns.delete(evicted)
    }
  }

  private clearRunPendings(
    runId: string,
    code: string,
    reason: string,
    requestTypes: readonly string[],
  ): void {
    for (const [requestId, entry] of this.pending) {
      if (entry.runId !== runId || !requestTypes.includes(entry.requestType)) continue
      clearTimeout(entry.timer)
      this.pending.delete(requestId)
      entry.reject(new CursorProtocolError(code, reason))
    }
  }

  /** Turn a reply message into the promise settle value; a reply that carries
   * an error payload rejects its request instead. */
  private replyValue(message: CursorProtocolMessage): CursorProtocolMessage | CursorProtocolError {
    if (message.type !== 'auth.result' && message.type !== 'models.result') return message
    const error = message.error
    if (error === undefined) return message
    return new CursorProtocolError(error.code, error.message)
  }

  /**
   * Settle the pending request a reply addresses. The reply must expect this
   * reply type and — for run-scoped replies — bind to the pending request's
   * own run id and capability, so a terminal or tool result can never settle
   * a different run's promise.
   */
  private settleReply(
    requestId: string,
    type: string,
    settle: (entry: PendingEntry) => void,
    binding?: { runId: string; capability?: string },
  ): void {
    const entry = this.pending.get(requestId)
    if (!entry) {
      // Already settled by a timeout, cancel, terminal, or worker exit — or
      // forged. Either way the reply matches no pending request.
      this.options.onRejection?.({ kind: 'unknown-request-id', requestId, type })
      return
    }
    if (entry.expectedReply !== type) {
      this.options.onRejection?.({
        kind: 'invalid-message',
        type,
        detail: `expected "${entry.expectedReply}" reply for "${entry.requestType}" request`,
      })
      return
    }
    if (binding !== undefined && entry.runId !== binding.runId) {
      this.options.onRejection?.({ kind: 'run-mismatch', requestId, type, runId: binding.runId })
      return
    }
    if (binding?.capability !== undefined && entry.capability !== binding.capability) {
      this.options.onRejection?.({
        kind: 'capability-mismatch',
        runId: binding.runId,
        type,
      })
      return
    }
    clearTimeout(entry.timer)
    this.pending.delete(requestId)
    settle(entry)
  }

  private handleTimeout(requestId: string, requestType: string, timeoutMs: number): void {
    const entry = this.pending.get(requestId)
    if (!entry) return
    this.pending.delete(requestId)
    // A timeout means the peer may be hung with in-flight state we cannot
    // observe; the caller must terminate or recycle the worker.
    this.recycleRequired = true
    // A run that never answered its run.start can never complete either.
    if (entry.requestType === 'run.start' && entry.runId !== null) {
      this.closeRun(entry.runId, 'timeout', `cursor run "${entry.runId}" timed out`)
    }
    entry.reject(
      new CursorProtocolError(
        'timeout',
        `cursor protocol request "${requestType}" timed out after ${timeoutMs}ms`,
      ),
    )
    this.options.onRejection?.({ kind: 'timeout', requestId, type: requestType })
  }
}
