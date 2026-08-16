# Security

`@smart-table/security` adds role-based authorization on top of a table's write surface: declarative roles, permission inheritance and a `TableGuard` that blocks disallowed mutations. It is a foundation release — enforcement is per-request, and you still authenticate the user in your own layer.

## Install

```bash
pnpm add @smart-table/security
```

## Roles

```ts
import { createSecurityPolicy } from '@smart-table/security';

const policy = createSecurityPolicy({
  roles: [
    { name: 'viewer', permissions: ['view'] },
    { name: 'editor', permissions: ['add', 'edit'], inherits: ['viewer'] },
    { name: 'admin', permissions: ['view', 'add', 'edit', 'delete', 'export'] },
  ],
});

policy.can('editor', 'edit'); // true (view inherited from viewer)
policy.can('editor', 'delete'); // false
policy.require('viewer', 'export'); // throws PermissionDeniedError
```

Permissions: `view`, `add`, `edit`, `delete`, `export` (see `ALL_PERMISSIONS`). Unknown roles are denied (fail closed). Cyclic inheritance is handled safely.

## Guarding a table

`createTableGuard` wraps the write methods so each action checks the active role:

```ts
import { createTableGuard } from '@smart-table/security';

let currentUser = 'viewer';
const guard = createTableGuard(table, policy, { getRole: () => currentUser });

guard.canEdit(); // false
guard.updateCell('42', 'name', 'Ada'); // ✗ PermissionDeniedError
guard.removeRow('7'); // ✗ PermissionDeniedError

currentUser = 'admin';
guard.removeRow('7'); // allowed
```

Each mutation maps to a permission:

| Action                             | Permission       |
| ---------------------------------- | ---------------- |
| `addRow(row)`                      | `add`            |
| `updateCell(target, field, value)` | `edit`           |
| `removeRow(target)`                | `delete`         |
| `data()`                           | read passthrough |

`assert(permission)` throws when the active role may not act; `can(permission)` is a non-throwing check. Reads are passed through — broader view-level authorization belongs to your app.

> **Status:** foundation release. Row- and column-level filters, audit logging and declarative policy files follow the v1.0 roadmap.
