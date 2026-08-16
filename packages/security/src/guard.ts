import type { SmartTable, DataRow } from '@smart-table/core';
import type { Permission, SecurityPolicy } from './policy';

export interface TableGuardOptions {
  /** Resolves the active role for the current user/session. */
  getRole: () => string;
}

export interface TableGuard {
  /** Tests a permission against the active role. */
  can(permission: Permission): boolean;
  /** Throws {@link PermissionDeniedError} when the active role may not. */
  assert(permission: Permission): void;
  /** Convenience shortcuts. */
  canView(): boolean;
  canAdd(): boolean;
  canEdit(): boolean;
  canDelete(): boolean;
  canExport(): boolean;
  /** Mutations, each gated by the matching permission. */
  addRow(row: DataRow): DataRow;
  updateCell(target: DataRow | string | number, field: string, value: unknown): DataRow | null;
  removeRow(target: DataRow | string | number): DataRow | null;
  /** Read-only passthroughs for building safe views/reports. */
  data(): DataRow[];
}

/**
 * thin authorization layer over a table's write surface. Reads remain
 * unrestricted (view permission is enforced by the surrounding app, not the
 * table), writes are gated per action.
 */
export function createTableGuard(
  table: SmartTable,
  policy: SecurityPolicy,
  options: TableGuardOptions
): TableGuard {
  const role = () => options.getRole();

  return {
    can: (permission) => policy.can(role(), permission),
    assert: (permission) => policy.require(role(), permission),
    canView: () => policy.can(role(), 'view'),
    canAdd: () => policy.can(role(), 'add'),
    canEdit: () => policy.can(role(), 'edit'),
    canDelete: () => policy.can(role(), 'delete'),
    canExport: () => policy.can(role(), 'export'),
    addRow(row) {
      policy.require(role(), 'add');
      return table.addRow(row);
    },
    updateCell(target, field, value) {
      policy.require(role(), 'edit');
      return table.updateCell(target, field, value);
    },
    removeRow(target) {
      policy.require(role(), 'delete');
      return table.removeRow(target);
    },
    data: () => table.getData(),
  };
}

export type { Permission, SecurityPolicy, RoleSpec, PermissionDeniedError } from './policy';
