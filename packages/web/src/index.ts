export { SmartTableElement, defineSmartTableElement, toKebab } from './element';
export type { Column, DataRow, SmartTableOptions, SmartTablePlugin } from '@smart-table/core';
export { SmartTable as SmartTableCore } from '@smart-table/core';

import { defineSmartTableElement } from './element';

// Self-registering when imported in a browser environment. Safe in SSR:
// `customElements` is undefined there and the call is a no-op guard.
defineSmartTableElement();
