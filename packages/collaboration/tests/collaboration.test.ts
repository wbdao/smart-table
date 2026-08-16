import { describe, it, expect, vi } from 'vitest';
import { SmartTable, type DataRow } from '@smart-table/core';
import {
  createCollaborationSession,
  localWins,
  resolveWith,
  lastWriteWins,
  type CollaborationMessage,
  type TransportAdapter,
} from '../src/index';

class MemoryTransport implements TransportAdapter {
  readonly name = 'memory';
  sent: CollaborationMessage[] = [];
  private readonly handlers = new Set<(m: CollaborationMessage) => void>();

  send(message: CollaborationMessage): void {
    this.sent.push(message);
    for (const handler of [...this.handlers]) handler(message);
  }

  onMessage(handler: (m: CollaborationMessage) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

const columns = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'age', header: 'Age' },
];

const rows: DataRow[] = [
  { id: 1, name: 'Ada', age: 36 },
  { id: 2, name: 'Linus', age: 54 },
];

function makeTable(): SmartTable {
  return new SmartTable({ columns, data: rows.map((r) => ({ ...r })) });
}

describe('createCollaborationSession', () => {
  it('publishes a typed op for a local cell edit', () => {
    const table = makeTable();
    const transport = new MemoryTransport();
    const session = createCollaborationSession(table, {
      transport,
      tableId: 'sheet',
      author: 'alice',
    });

    table.updateCell('1', 'age', 37);

    expect(transport.sent).toHaveLength(1);
    const msg = transport.sent[0]!;
    expect(msg.type).toBe('op');
    expect(msg.author).toBe('alice');
    expect(msg.payload).toMatchObject({ kind: 'update', field: 'age', value: 37 });
    expect(msg.baselineVersion).toBe(0);
    expect(session.version()).toBe(1);
    session.destroy();
  });

  it('applies remote ops to another table without echoing back', () => {
    const a = makeTable();
    const b = makeTable();
    const transport = new MemoryTransport();
    const sessionA = createCollaborationSession(a, {
      transport,
      tableId: 'sheet',
      author: 'alice',
    });
    createCollaborationSession(b, { transport, tableId: 'sheet', author: 'bob' });

    a.updateCell('2', 'age', 55);

    const bRow = b.getData().find((r) => (r as { id: number }).id === 2) as { age: number };
    expect(bRow.age).toBe(55);
    // 'bob' never published anything.
    expect(transport.sent.filter((m) => m.author === 'bob')).toHaveLength(0);
    sessionA.destroy();
  });

  it('propagates insert and delete ops', () => {
    const a = makeTable();
    const b = makeTable();
    const transport = new MemoryTransport();
    const sessionA = createCollaborationSession(a, {
      transport,
      tableId: 'sheet',
      author: 'alice',
    });
    createCollaborationSession(b, { transport, tableId: 'sheet', author: 'bob' });

    a.addRow({ id: 3, name: 'Grace', age: 29 });
    a.removeRow('1');

    expect(b.getData()).toHaveLength(2);
    expect(b.getData().some((r) => (r as { id: number }).id === 3)).toBe(true);
    expect(b.getData().some((r) => (r as { id: number }).id === 1)).toBe(false);
    sessionA.destroy();
  });

  it('uses last-write-wins by default when versions diverge', () => {
    const a = makeTable();
    const transport = new MemoryTransport();
    const sessionA = createCollaborationSession(a, {
      transport,
      tableId: 'sheet',
      author: 'alice',
    });
    a.updateCell('1', 'name', 'Ada Lovelace');
    a.updateCell('1', 'age', 95);
    expect(sessionA.version()).toBe(2);

    transport.send({
      type: 'op',
      tableId: 'sheet',
      author: 'carol',
      seq: 5,
      baselineVersion: 0,
      timestamp: Date.now(),
      payload: { kind: 'update', rowId: '1', field: 'name', value: 'CAROL' },
    });

    const row = a.getData().find((r) => (r as { id: number }).id === 1) as { name: string };
    expect(row.name).toBe('CAROL');
    expect(sessionA.version()).toBe(5);
    sessionA.destroy();
  });

  it('local-wins drops divergent remote ops', () => {
    const a = makeTable();
    const transport = new MemoryTransport();
    const sessionA = createCollaborationSession(a, {
      transport,
      tableId: 'sheet',
      author: 'alice',
      resolver: localWins(),
    });
    a.updateCell('1', 'name', 'Ada Lovelace');
    expect(sessionA.version()).toBe(1);

    transport.send({
      type: 'op',
      tableId: 'sheet',
      author: 'carol',
      seq: 2,
      baselineVersion: 0,
      timestamp: Date.now(),
      payload: { kind: 'update', rowId: '1', field: 'name', value: 'CAROL' },
    });

    const row = a.getData().find((r) => (r as { id: number }).id === 1) as { name: string };
    expect(row.name).toBe('Ada Lovelace');
    sessionA.destroy();
  });

  it('lets a custom resolver pick the surviving op', () => {
    const a = makeTable();
    const transport = new MemoryTransport();
    const sessionA = createCollaborationSession(a, {
      transport,
      tableId: 'sheet',
      author: 'alice',
      resolver: resolveWith(() => ({
        kind: 'update',
        rowId: '1',
        field: 'name',
        value: 'RESOLVED',
      })),
    });
    a.updateCell('1', 'name', 'Ada Foo');
    expect(sessionA.version()).toBe(1);

    transport.send({
      type: 'op',
      tableId: 'sheet',
      author: 'carol',
      seq: 2,
      baselineVersion: 0,
      timestamp: Date.now(),
      payload: { kind: 'update', rowId: '1', field: 'name', value: 'CAROL' },
    });

    const row = a.getData().find((r) => (r as { id: number }).id === 1) as { name: string };
    expect(row.name).toBe('RESOLVED');
    sessionA.destroy();
  });

  it('calls the conflict resolver when baselines diverge', () => {
    const a = makeTable();
    const transport = new MemoryTransport();
    const resolver = {
      resolve: vi.fn((_c: { localVersion: number }) => ({ decision: 'remote-wins' as const })),
    };
    const sessionA = createCollaborationSession(a, {
      transport,
      tableId: 'sheet',
      author: 'alice',
      resolver,
    });
    a.updateCell('1', 'age', 40);
    expect(sessionA.version()).toBe(1);

    transport.send({
      type: 'op',
      tableId: 'sheet',
      author: 'carol',
      seq: 9,
      baselineVersion: 0,
      timestamp: Date.now(),
      payload: { kind: 'update', rowId: '1', field: 'age', value: 80 },
    });

    expect(resolver.resolve).toHaveBeenCalledTimes(1);
    expect(resolver.resolve).toHaveBeenCalledWith(expect.objectContaining({ localVersion: 1 }));
    const row = a.getData().find((r) => (r as { id: number }).id === 1) as { age: number };
    expect(row.age).toBe(80);
    sessionA.destroy();
  });

  it('sync() publishes a full snapshot that replaces the peer dataset', () => {
    const a = makeTable();
    const b = makeTable();
    const transport = new MemoryTransport();
    const sessionA = createCollaborationSession(a, {
      transport,
      tableId: 'sheet',
      author: 'alice',
    });
    const sessionB = createCollaborationSession(b, { transport, tableId: 'sheet', author: 'bob' });

    sessionA.sync();

    expect(transport.sent[transport.sent.length - 1]).toMatchObject({ type: 'snapshot' });
    expect(b.getData()).toEqual(a.getData());
    expect(sessionB.version()).toBe(1);
    sessionA.destroy();
    sessionB.destroy();
  });

  it('destroy() unsubscribes from table events and the transport', () => {
    const a = makeTable();
    const transport = new MemoryTransport();
    const sessionA = createCollaborationSession(a, {
      transport,
      tableId: 'sheet',
      author: 'alice',
    });
    sessionA.destroy();
    const before = transport.sent.length;
    a.updateCell('1', 'age', 44);
    a.addRow({ id: 9, name: 'Ken', age: 31 });
    expect(transport.sent).toHaveLength(before);
  });

  it('exports default resolvers', () => {
    expect(lastWriteWins().resolve({} as never).decision).toBe('remote-wins');
    expect(localWins().resolve({} as never).decision).toBe('local-wins');
  });
});
