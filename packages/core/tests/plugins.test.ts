import { describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { createPluginRegistry, definePlugin } from '../src/plugins/registry';

function makeTable(): SmartTable {
  return new SmartTable({
    columns: [{ field: 'a', type: 'number' }],
    data: [{ a: 1 }, { a: 2 }],
  });
}

describe('PluginRegistry marketplace catalog', () => {
  it('definePlugin fills defaults and satisfies the core plugin contract', () => {
    const plugin = definePlugin({
      name: 'p1',
      description: 'A demo plugin',
      meta: { author: 'Me', tags: ['ui'] },
      install: vi.fn(),
      uninstall: vi.fn(),
    });
    expect(plugin.name).toBe('p1');
    expect(plugin.version).toBe('0.0.0');
    expect(plugin.description).toBe('A demo plugin');
    expect(plugin.meta).toEqual({ author: 'Me', tags: ['ui'] });
    expect(typeof plugin.install).toBe('function');
    expect(typeof plugin.uninstall).toBe('function');
  });

  it('registers, lists (metadata only) and removes plugins', () => {
    const registry = createPluginRegistry();
    registry.register(definePlugin({ name: 'alpha', install: () => undefined }));
    registry.register(
      definePlugin({
        name: 'beta',
        version: '2.0.0',
        meta: { tags: ['x'] },
        install: () => undefined,
      })
    );

    expect(registry.has('alpha')).toBe(true);
    expect(registry.list()).toEqual([
      { name: 'alpha', version: '0.0.0' },
      { name: 'beta', version: '2.0.0', meta: { tags: ['x'] } },
    ]);

    expect(registry.unregister('alpha')).toBe(true);
    expect(registry.has('alpha')).toBe(false);
    expect(registry.unregister('alpha')).toBe(false);
  });

  it('rejects duplicate registrations by name', () => {
    const registry = createPluginRegistry();
    registry.register(definePlugin({ name: 'dup', install: () => undefined }));
    expect(() =>
      registry.register(definePlugin({ name: 'dup', install: () => undefined }))
    ).toThrow(/already registered/);
  });

  it('installOn uses table.use and reports how many were installed', () => {
    const table = makeTable();
    const install = vi.fn((t: SmartTable) => {
      void t;
    });
    const registry = createPluginRegistry();
    registry.register(definePlugin({ name: 'one', install }));
    registry.register(definePlugin({ name: 'two', install }));

    expect(registry.installOn(table)).toBe(2);
    expect(install).toHaveBeenCalledTimes(2);
    expect(
      table
        .getPlugins()
        .map((p) => p.name)
        .sort()
    ).toEqual(['one', 'two']);

    // Idempotent — a second install skips already-installed plugins.
    expect(registry.installOn(table)).toBe(0);
    expect(install).toHaveBeenCalledTimes(2);
  });

  it('installs a single plugin by name', () => {
    const table = makeTable();
    const registry = createPluginRegistry();
    registry.register(definePlugin({ name: 'solo', install: () => undefined }));

    expect(registry.install(table, 'solo')).toBe(true);
    expect(registry.install(table, 'solo')).toBe(false); // already installed
    expect(registry.install(table, 'missing')).toBe(false);
    expect(table.getPlugin('solo')).toBeDefined();
  });

  it('uninstallFrom tears down every active registered plugin', () => {
    const table = makeTable();
    const registry = createPluginRegistry();
    const uninstall = vi.fn();
    registry.register(definePlugin({ name: 'a', install: () => undefined, uninstall }));
    registry.register(definePlugin({ name: 'b', install: () => undefined }));
    registry.installOn(table);

    expect(registry.uninstallFrom(table)).toBe(2);
    expect(uninstall).toHaveBeenCalledTimes(1);
    expect(table.getPlugins()).toEqual([]);
  });
});
