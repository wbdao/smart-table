/**
 * Collaboration will be built on top of the contract in `src/types.ts`:
 * - `TransportAdapter` is the only thing a peer says "how to move bytes".
 * - `SyncAdapter` describes read/write of an authoritative document.
 * - `ConflictResolver` decides what happens when optimistic edits collide.
 *
 * This package ships the types, default resolvers and a reference
 * `createCollaborationSession` implementation so every future adapter
 * (WebSocket, Yjs, ShareDB, CRDTs …) can hook in without core changes.
 */
export interface CollaborationMessage {
  /** `op` streams an incremental edit; `snapshot` replaces the dataset. */
  type: 'op' | 'snapshot';
  tableId: string;
  author: string;
  /** Monotonic sequence number assigned by the sending peer. */
  seq: number;
  /** Version the sender believed the table to be at when it made the change. */
  baselineVersion: number;
  payload: unknown;
  timestamp: number;
}

/** Anything that can carry {@link CollaborationMessage}s in and out. */
export interface TransportAdapter {
  readonly name?: string;
  connect?(): Promise<void> | void;
  disconnect?(): Promise<void> | void;
  send(message: CollaborationMessage): void | Promise<void>;
  /** Registers a handler; returns an unsubscribe function. */
  onMessage(handler: (message: CollaborationMessage) => void): () => void;
}

/** An authoritative document store backend (e.g. a REST doc API or a DB). */
export interface SyncAdapter<S = unknown> {
  /** Reads the current document. */
  read(): Promise<S>;
  /** Writes a full document. */
  write(doc: S): Promise<void>;
  /** Applies a batch of operations transactionally, if supported. */
  apply?(ops: SyncOperation[]): Promise<void>;
}

/** A single incremental edit to the dataset. */
export type SyncOperation =
  | { kind: 'update'; rowId: string; field: string; value: unknown }
  | { kind: 'insert'; rowId: string; row: Record<string, unknown> }
  | { kind: 'delete'; rowId: string }
  | { kind: 'replace'; rows: Record<string, unknown>[] };

export type ConflictDecision = 'local-wins' | 'remote-wins' | 'resolve';

export interface ConflictContext {
  operation: SyncOperation;
  message: CollaborationMessage;
  localVersion: number;
}

export interface ConflictResolver {
  resolve(context: ConflictContext): {
    decision: ConflictDecision;
    op?: SyncOperation;
  };
}

/** Incoming edits always win. */
export function remoteWins(): ConflictResolver {
  return { resolve: () => ({ decision: 'remote-wins' }) };
}

/** Local edits are kept; incoming edits are dropped (until a snapshot). */
export function localWins(): ConflictResolver {
  return { resolve: () => ({ decision: 'local-wins' }) };
}

/** Let a custom resolver pick the surviving op. */
export function resolveWith(fn: (context: ConflictContext) => SyncOperation): ConflictResolver {
  return { resolve: (c) => ({ decision: 'resolve', op: fn(c) }) };
}

/** Afterwards the incoming op is applied unconditionally. */
export const lastWriteWins = remoteWins;
