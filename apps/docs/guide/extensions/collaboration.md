# Collaboration

`@smart-table/collaboration` provides the foundations for multi-user tables: a transport contract, sync operations, conflict resolution and a reference session. It is intentionally library-agnostic — WebSocket, Yjs, ShareDB or a simple REST backend all fit through the same interfaces.

## Install

```bash
pnpm add @smart-table/collaboration
```

## Concepts

| Piece                        | Role                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `TransportAdapter`           | Moves `CollaborationMessage`s in and out (send + subscribe). |
| `SyncAdapter`                | Read/write an authoritative document (REST doc API, DB).     |
| `ConflictResolver`           | Decides what survives when optimistic edits diverge.         |
| `createCollaborationSession` | Wires a table + transport together and keeps them in sync.   |

## Session

```ts
import { SmartTable } from '@smart-table/core';
import { createCollaborationSession, lastWriteWins } from '@smart-table/collaboration';

const table = new SmartTable({ columns, data });
const session = createCollaborationSession(table, {
  transport: myWebSocketTransport,
  resolver: lastWriteWins(), // incoming edits win
  author: 'alice',
  tableId: 'sheet/prefs',
});
```

Local `cellEdit`, `rowAdded`, `rowDeleted` and `setData` become typed `op` or `snapshot` messages on the transport. Remote messages are applied to the table and do not echo back.

### Versions and conflicts

Each op carries the sender's `baselineVersion`. When a message arrives with a baseline that does not match the receiver's version, the `ConflictResolver` is invoked with the op, message and local version:

```ts
import { resolveWith } from '@smart-table/collaboration';

createCollaborationSession(table, {
  transport,
  resolver: resolveWith(({ operation, message, localVersion }) => ({
    kind: 'update',
    rowId: operation.kind === 'update' ? operation.rowId : '',
    field: 'updatedAt',
    value: message.timestamp,
  })),
});
```

Built-in resolvers: `lastWriteWins()` (remote wins), `remoteWins()`, `localWins()`, and `resolveWith(fn)` for bespoke merge logic.

### Tidying up

```ts
session.sync(); // push a full snapshot
session.destroy(); // unsubscribe from events and the transport
```

> **Status:** this package is a foundation release. It demonstrates the contracts and a working optimistic flow, but is not yet a production CRDT backend. Follow the v1.0 roadmap to see collaboration become first-class.
