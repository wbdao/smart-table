import type { SmartTable } from '@smart-table/core';
import {
  lastWriteWins,
  type CollaborationMessage,
  type ConflictResolver,
  type SyncOperation,
  type TransportAdapter,
} from './types';

export interface SessionOptions {
  transport: TransportAdapter;
  resolver?: ConflictResolver;
  /** Peer identity stamped on every message (default `'local'`). */
  author?: string;
  tableId?: string;
}

export interface CollaborationSession {
  readonly tableId: string;
  readonly author: string;
  /** Current local version; consult before optimistic edits. */
  version(): number;
  /** Pushes a full snapshot to the transport. */
  sync(): void;
  /** Unsubscribes from table events and the transport. */
  destroy(): void;
}

/** Builds a {@link SyncOperation} from the table's live event payloads. */
function toOperation(table: SmartTable, event: string, payload: unknown): SyncOperation | null {
  switch (event) {
    case 'cellEdit': {
      const p = payload as { rowId?: string; row?: unknown; field: string; newValue: unknown };
      return {
        kind: 'update',
        rowId: p.rowId ?? table.getRowId(p.row as never) ?? '',
        field: p.field,
        value: p.newValue,
      };
    }
    case 'rowAdded': {
      const p = payload as { rowId?: string; row: Record<string, unknown>; rowIndex: number };
      return { kind: 'insert', rowId: p.rowId ?? '', row: p.row };
    }
    case 'rowDeleted': {
      const p = payload as { rowId?: string; row?: Record<string, unknown> };
      return {
        kind: 'delete',
        rowId: p.rowId ?? (p.row ? table.getRowId(p.row as never) : undefined) ?? '',
      };
    }
    case 'dataChanged': {
      const p = payload as { operation: string };
      if (p.operation === 'setData' || p.operation === 'loadMore') {
        return { kind: 'replace', rows: table.getData() as Record<string, unknown>[] };
      }
      return null;
    }
    default:
      return null;
  }
}

/** Applies a {@link SyncOperation} to the table without local echo. */
export function applyOperation(table: SmartTable, op: SyncOperation): void {
  switch (op.kind) {
    case 'update':
      table.updateCell(op.rowId, op.field, op.value);
      break;
    case 'insert':
      table.addRow(op.row);
      break;
    case 'delete':
      table.removeRow(op.rowId);
      break;
    case 'replace':
      table.setData(op.rows as never);
      break;
  }
}

/** Reference session wiring a table and a transport together. */
export function createCollaborationSession(
  table: SmartTable,
  options: SessionOptions
): CollaborationSession {
  const author = options.author ?? 'local';
  const tableId = options.tableId ?? table.id;
  const transport = options.transport;
  const resolver = options.resolver ?? lastWriteWins();

  let localVersion = 0;
  let seq = 0;
  let applyingRemote = false;
  let destroyed = false;
  const unsubscribers: Array<() => void> = [];

  function publish(
    type: CollaborationMessage['type'],
    payload: unknown,
    baselineVersion: number
  ): void {
    seq += 1;
    transport.send({
      type,
      tableId,
      author,
      seq,
      baselineVersion,
      payload,
      timestamp: Date.now(),
    });
  }

  function onTableEvent(event: string, payload: unknown): void {
    if (applyingRemote) return;
    const op = toOperation(table, event, payload);
    if (!op) return;
    if (op.kind === 'replace') {
      localVersion += 1;
      publish('snapshot', op, localVersion - 1);
      return;
    }
    localVersion += 1;
    publish('op', op, localVersion - 1);
  }

  function handleMessage(message: CollaborationMessage): void {
    if (destroyed || message.tableId !== tableId || message.author === author) return;
    const op = message.payload as SyncOperation;
    applyingRemote = true;
    try {
      if (message.baselineVersion !== localVersion) {
        const decision = resolver.resolve({
          operation: op,
          message,
          localVersion,
        }).decision;
        if (decision === 'local-wins') return;
        if (decision === 'remote-wins') {
          applyOperation(table, op);
        } else {
          const resolved = resolver.resolve({ operation: op, message, localVersion }).op;
          if (resolved) applyOperation(table, resolved);
        }
      } else {
        applyOperation(table, op);
      }
      localVersion = message.seq;
    } finally {
      applyingRemote = false;
    }
  }

  for (const event of ['cellEdit', 'rowAdded', 'rowDeleted', 'dataChanged'] as const) {
    unsubscribers.push(table.on(event, (payload: unknown) => onTableEvent(event, payload)));
  }
  unsubscribers.push(transport.onMessage(handleMessage));

  return {
    get tableId() {
      return tableId;
    },
    get author() {
      return author;
    },
    version: () => localVersion,
    sync: () => {
      localVersion += 1;
      publish(
        'snapshot',
        { kind: 'replace', rows: table.getData() as Record<string, unknown>[] },
        localVersion - 1
      );
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      for (const off of unsubscribers.splice(0)) off();
    },
  };
}
