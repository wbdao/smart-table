import type { SmartTable } from '@smart-table/core';
import { DevToolsState, type DevToolsSnapshot } from './state';
import { createDevToolsPanel, type DevToolsPanel } from './panel';

export type { DevToolsSnapshot, DevEventRecord, DevToolsState } from './state';
export type { DevToolsPanel } from './panel';

export interface DevToolsOptions {
  /** Element to mount the overlay into (defaults to the table container, then `document.body`). */
  mount?: HTMLElement;
  /** Ring-buffer size for the event stream (default 100). */
  maxEvents?: number;
  /** Overlay title shown at the top of the panel. */
  title?: string;
}

export interface DevToolsController {
  readonly table: SmartTable;
  readonly panel: DevToolsPanel;
  /** Shows the overlay (visible by default). */
  show(): void;
  /** Hides the overlay without detaching it. */
  hide(): void;
  /** Toggles overlay visibility. */
  toggle(): void;
  /** Force-refreshes the rendered panel from live table state. */
  update(): void;
  /** Current state snapshot (safe to read at any time). */
  getSnapshot(): DevToolsSnapshot;
  /** Removes the panel and unsubscribes from the table event bus. */
  destroy(): void;
}

const controllers = new WeakMap<SmartTable, DevToolsController>();

/** Attaches the devtools overlay to a table; repeated calls return the same controller. */
export function attachDevTools(
  table: SmartTable,
  options: DevToolsOptions = {}
): DevToolsController {
  const existing = controllers.get(table);
  if (existing) return existing;

  const state = new DevToolsState(table, { maxEvents: options.maxEvents });
  const panel = createDevToolsPanel(table, state, options);
  state.attach();

  const controller: DevToolsController = {
    table,
    panel,
    show: () => panel.show(),
    hide: () => panel.hide(),
    toggle: () => panel.toggle(),
    update: () => panel.update(),
    getSnapshot: () => state.snapshot,
    destroy: () => {
      if (controllers.get(table) !== controller) return;
      state.detach();
      panel.destroy();
      controllers.delete(table);
    },
  };

  controllers.set(table, controller);
  return controller;
}

/** Detaches and destroys the devtools overlay for a table, if attached. */
export function detachDevTools(table: SmartTable): void {
  controllers.get(table)?.destroy();
}
