import type { SmartTable } from '../core/SmartTable';

/**
 * A rendering strategy attached to a {@link SmartTable}.
 *
 * The base contract is deliberately tiny: `mount`, `unmount` and `render`.
 * Renderers communicate with the table exclusively through the typed event
 * bus and the public data accessors, so the core never learns about the DOM.
 * `DOMRenderer` (the built-in Vanilla implementation) extends this class and
 * registers itself as the default factory for `table.mount()`.
 */
export abstract class Renderer {
  /** The table this renderer presents. */
  readonly table: SmartTable;

  constructor(table: SmartTable) {
    this.table = table;
  }

  /** Attaches the renderer to its target and performs the first render. */
  abstract mount(): void;

  /** Detaches the renderer, removes DOM and unsubscribes from events. */
  abstract unmount(): void;

  /** Rebuilds the whole view from the current table state. */
  abstract render(): void;

  /** Whether the renderer is currently mounted. */
  isMounted(): boolean {
    return false;
  }
}

/**
 * Factory used by `SmartTable.registerRenderer` / `table.mount()`.
 * The factory receives the table and an optional resolved target element.
 */
export type RendererFactory = (table: SmartTable, target: HTMLElement | null) => Renderer;
