import type { SmartTable } from '../core/SmartTable';
import type { SmartTablePlugin } from '../types/plugin';

/**
 * Plugin marketplace — a discoverable catalog of {@link SmartTablePlugin}s.
 *
 * The core's first-party plugin API is `table.use(plugin)` / `table.unuse(name)`
 * (see `types/plugin.ts`). This registry layers catalog semantics on top:
 * authors register plugins once (with marketplace metadata) and consumers ask
 * the registry to install the whole catalog (or one plugin by name) onto a
 * table. The catalog never executes plugin code until `installOn()` runs.
 *
 * ```ts
 * const store = createPluginRegistry();
 * store.register(summaryFooterPlugin());
 * store.register(eventLogPlugin());
 *
 * const table = new SmartTable(options);
 * store.installOn(table);   // table.use(...) for each registered plugin
 * const listed = store.list(); // marketplace descriptors (name/version/meta)
 * ```
 */

/** Free-form marketplace metadata attached to a plugin. */
export interface PluginMeta {
  /** Author / maintainer label shown on a marketplace card. */
  author?: string;
  /** URL for documentation or the plugin's source. */
  homepage?: string;
  /** Searchable categories (e.g. `['ui', 'aggregate']`). */
  tags?: string[];
  [key: string]: unknown;
}

/** Options accepted by {@link definePlugin}. */
export interface DefinePluginOptions {
  /** Unique plugin id (also used as the plugin's `name`). */
  name: string;
  /** Suggested version. Defaults to `0.0.0`. */
  version?: string;
  /** One-line description for marketplace listings. */
  description?: string;
  /** Marketplace metadata (author, homepage, tags, …). */
  meta?: PluginMeta;
  install(table: SmartTable): void;
  uninstall?(table: SmartTable): void;
}

/**
 * Declarative helper that fills defaults so authors only write the hooks.
 * Returns an object satisfying the core {@link SmartTablePlugin} contract.
 */
export function definePlugin(options: DefinePluginOptions): SmartTablePlugin {
  return {
    name: options.name,
    version: options.version ?? '0.0.0',
    ...(options.description ? { description: options.description } : {}),
    ...(options.meta ? { meta: options.meta } : {}),
    install: options.install,
    ...(options.uninstall ? { uninstall: options.uninstall } : {}),
  };
}

/** Marketplace-facing view of a registered plugin (no executable code). */
export interface PluginDescriptor {
  name: string;
  version: string;
  description?: string;
  meta?: Readonly<PluginMeta>;
}

/**
 * In-memory catalog of marketplace plugins. Registering only stores metadata
 * and the plugin object; nothing runs until a table installs it.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, SmartTablePlugin>();

  register(plugin: SmartTablePlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered.`);
    }
    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /** Marketplace listing — metadata only, never the plugin implementation. */
  list(): PluginDescriptor[] {
    return [...this.plugins.values()].map((plugin) => ({
      name: plugin.name,
      version: plugin.version ?? '0.0.0',
      ...(plugin.description ? { description: plugin.description } : {}),
      ...(plugin.meta ? { meta: plugin.meta } : {}),
    }));
  }

  /**
   * Installs every registered plugin onto `table`. Already-installed plugins
   * are skipped (deduped by name); returns how many were newly installed.
   */
  installOn(table: SmartTable): number {
    let count = 0;
    for (const plugin of this.plugins.values()) {
      if (!table.getPlugin(plugin.name)) {
        table.use(plugin);
        count += 1;
      }
    }
    return count;
  }

  /** Installs a single plugin by name. Returns `false` when unknown/installed. */
  install(table: SmartTable, name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin || table.getPlugin(name)) return false;
    table.use(plugin);
    return true;
  }

  /** Uninstalls every registered plugin currently active on `table`. */
  uninstallFrom(table: SmartTable): number {
    let count = 0;
    for (const plugin of this.plugins.values()) {
      if (table.getPlugin(plugin.name) && table.unuse(plugin.name)) {
        count += 1;
      }
    }
    return count;
  }
}

/** Factory shorthand mirroring the other feature modules. */
export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}
