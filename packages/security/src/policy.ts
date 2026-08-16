/**
 * Security foundations: role-based permissions for `SmartTable`-backed apps.
 * `@smart-table/security` ships a declarative role model, inheritance, and a
 * table guard that gates mutations on the current role's permissions.
 */
export type Permission = 'view' | 'add' | 'edit' | 'delete' | 'export';

/** Wildcard that expands to every known {@link Permission}. */
export const ALL_PERMISSIONS: readonly Permission[] = ['view', 'add', 'edit', 'delete', 'export'];

export interface RoleSpec {
  name: string;
  permissions: Permission[];
  /** Other roles whose permissions are merged into this one. */
  inherits?: string[];
}

export interface SecurityPolicyOptions {
  roles: RoleSpec[];
}

/** Thrown when the active role lacks the required permission. */
export class PermissionDeniedError extends Error {
  readonly permission: Permission;
  readonly role: string;
  constructor(role: string, permission: Permission) {
    super(`Permission denied: role "${role}" may not "${permission}".`);
    this.name = 'PermissionDeniedError';
    this.role = role;
    this.permission = permission;
  }
}

export interface SecurityPolicy {
  /** Resolves the full permission set for a role (merging `inherits`). */
  permissionsFor(role: string): Set<Permission>;
  /** Whether a role may perform an action. Unknown roles are denied. */
  can(role: string, permission: Permission): boolean;
  /** Throws {@link PermissionDeniedError} when the role may not. */
  require(role: string, permission: Permission): void;
  /** Returns a wrapped function that enforces the permission on each call. */
  guard<A extends unknown[]>(
    role: string,
    permission: Permission,
    fn: (...args: A) => unknown
  ): (...args: A) => unknown;
}

export function createSecurityPolicy(options: SecurityPolicyOptions): SecurityPolicy {
  const roles = new Map<string, RoleSpec>();
  for (const spec of options.roles) roles.set(spec.name, spec);
  const cache = new Map<string, Set<Permission>>();

  function permissionsFor(role: string): Set<Permission> {
    const cached = cache.get(role);
    if (cached) return cached;
    const resolved = new Set<Permission>();
    // Fail closed: unknown roles and unknown permissions are denied.
    const visit = (name: string, stack: string[]): void => {
      if (stack.includes(name)) return; // cycle-safe
      const spec = roles.get(name);
      if (!spec) return;
      for (const inherited of spec.inherits ?? []) visit(inherited, [...stack, name]);
      for (const p of spec.permissions) resolved.add(p);
    };
    visit(role, []);
    cache.set(role, resolved);
    return resolved;
  }

  const policy: SecurityPolicy = {
    permissionsFor,
    can: (role, permission) => permissionsFor(role).has(permission),
    require(role: string, permission: Permission): void {
      if (!policy.can(role, permission)) throw new PermissionDeniedError(role, permission);
    },
    guard:
      <A extends unknown[]>(role: string, permission: Permission, fn: (...args: A) => unknown) =>
      (...args: A) => {
        policy.require(role, permission);
        return fn(...args);
      },
  };
  return policy;
}
