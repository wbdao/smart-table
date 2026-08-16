import type { SmartTable } from '../core/SmartTable';

/**
 * A SmartTableJS plugin.
 *
 * Plugins are installed with `table.use(plugin)` and receive the table
 * instance so they can attach to the event bus, register toolbar actions or
 * replace rendering hooks. They are uninstalled when `table.destroy()` runs
 * (and can also be removed explicitly with `table.unuse(name)`).
 *
 * The extra `description` and `meta` fields power the marketplace catalog:
 * `PluginRegistry.list()` returns them so a registry/website can render a
 * discoverable library of plugins without executing them.
 *
 * @example
 * const SortingPlugin: SmartTablePlugin = {
 *   name: 'sorting',
 *   description: 'Cycles through sort states on header clicks.',
 *   meta: { author: 'SmartTableJS', tags: ['sort', 'ui'] },
 *   install(table) { /* ... *\/ },
 *   uninstall(table) { /* ... *\/ },
 * };
 * table.use(SortingPlugin);
 */
export interface SmartTablePlugin {
  /** Unique plugin id used for deduplication and lookups. */
  name: string;
  /** Optional semantic version of the plugin. */
  version?: string;
  /** Human-readable one-liner shown in a plugin marketplace. */
  description?: string;
  /** Arbitrary marketplace metadata (author, homepage, tags, …). */
  meta?: Readonly<Record<string, unknown>>;
  /** Called once when the plugin is registered. */
  install(table: SmartTable): void;
  /** Called when the plugin is removed or the table is destroyed. */
  uninstall?(table: SmartTable): void;
}
