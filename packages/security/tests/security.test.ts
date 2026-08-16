import { describe, it, expect } from 'vitest';
import { SmartTable, type DataRow } from '@smart-table/core';
import {
  createSecurityPolicy,
  createTableGuard,
  PermissionDeniedError,
  ALL_PERMISSIONS,
} from '../src/index';

const columns = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
];
const rows: DataRow[] = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Linus' },
];

const policy = createSecurityPolicy({
  roles: [
    { name: 'viewer', permissions: ['view'] },
    { name: 'editor', permissions: ['view', 'add', 'edit'], inherits: ['viewer'] },
    { name: 'admin', permissions: ['view', 'add', 'edit', 'delete', 'export'] },
  ],
});

function makeTable(): SmartTable {
  return new SmartTable({ columns, data: rows.map((r) => ({ ...r })) });
}

describe('createSecurityPolicy', () => {
  it('merges inherited permissions', () => {
    expect(policy.permissionsFor('editor').has('view')).toBe(true);
    expect(policy.permissionsFor('editor').has('edit')).toBe(true);
    expect(policy.permissionsFor('editor').has('delete')).toBe(false);
  });

  it('denies unknown roles and undecided permissions', () => {
    expect(policy.can('ghost', 'view')).toBe(false);
    expect(policy.can('viewer', 'edit')).toBe(false);
    expect(policy.can('admin', 'export')).toBe(true);
  });

  it('throws PermissionDeniedError from require', () => {
    expect(() => policy.require('viewer', 'delete')).toThrow(PermissionDeniedError);
    expect(() => policy.require('admin', 'export')).not.toThrow();
  });

  it('guard wraps a function with a permission check', () => {
    const publish = () => 'ok';
    const gated = policy.guard('editor', 'edit', publish);
    expect(gated()).toBe('ok');
    const denied = policy.guard('viewer', 'edit', publish);
    expect(() => denied()).toThrow(PermissionDeniedError);
  });

  it('handles cyclic inheritance without hanging', () => {
    const cycle = createSecurityPolicy({
      roles: [
        { name: 'a', permissions: ['view'], inherits: ['b'] },
        { name: 'b', permissions: ['add'], inherits: ['a'] },
      ],
    });
    expect(cycle.can('a', 'view')).toBe(true);
    expect(cycle.can('a', 'add')).toBe(true);
  });

  it('exposes every known permission via ALL_PERMISSIONS', () => {
    expect(ALL_PERMISSIONS).toContain('export');
  });
});

describe('createTableGuard', () => {
  it('gates mutations per role', () => {
    const table = makeTable();
    let role = 'viewer';
    const guard = createTableGuard(table, policy, { getRole: () => role });

    expect(guard.canView()).toBe(true);
    expect(guard.canEdit()).toBe(false);
    expect(() => guard.updateCell('1', 'name', 'Ada X')).toThrow(PermissionDeniedError);
    expect(() => guard.addRow({ id: 3, name: 'New' })).toThrow(PermissionDeniedError);

    role = 'editor';
    guard.updateCell('1', 'name', 'Ada X');
    expect(
      (table.getData().find((r) => (r as { id: number }).id === 1) as { name: string }).name
    ).toBe('Ada X');
  });

  it('delete requires the delete permission', () => {
    const table = makeTable();
    let role = 'editor';
    const guard = createTableGuard(table, policy, { getRole: () => role });
    expect(() => guard.removeRow('2')).toThrow(PermissionDeniedError);
    role = 'admin';
    guard.removeRow('2');
    expect(table.getData()).toHaveLength(1);
  });

  it('assert respects the active role', () => {
    const table = makeTable();
    const guard = createTableGuard(table, policy, { getRole: () => 'admin' });
    guard.assert('export');
    expect(guard.can('add')).toBe(true);
  });
});
