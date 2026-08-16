// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { PivotView } from '../src/ui/PivotView';
import '../src/ui/DOMRenderer'; // registers the default renderer factory
import type { Column, DataRow } from '../src/types';

const columns: Column[] = [
  { field: 'region', title: 'Region', type: 'string' },
  { field: 'product', title: 'Product', type: 'string' },
  { field: 'sales', title: 'Sales', type: 'number' },
];

const sales: DataRow[] = [
  { region: 'North', product: 'Laptop', sales: 100 },
  { region: 'North', product: 'Laptop', sales: 50 },
  { region: 'North', product: 'Mouse', sales: 50 },
  { region: 'South', product: 'Laptop', sales: 80 },
  { region: 'South', product: 'Mouse', sales: 40 },
];

function mount(target: HTMLElement): {
  table: SmartTable;
  root: HTMLElement;
  getView(): HTMLElement | null;
} {
  const table = new SmartTable({ columns, data: sales, container: target });
  table.mount();
  return {
    table,
    root: target,
    getView: () => target.querySelector('.st-viewport > *') as HTMLElement | null,
  };
}

function tableText(view: HTMLElement): string {
  return (view.textContent ?? '').replace(/\s+/g, ' ').trim();
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('PivotView', () => {
  it('renders row/column headers and intersection values', () => {
    const table = new SmartTable({ columns, data: sales });
    table.pivot({
      rows: ['region'],
      columns: ['product'],
      values: [{ field: 'sales', aggregation: 'sum' }],
    });
    const view = new PivotView({ table });
    document.body.appendChild(view.element);

    const text = tableText(view.element);
    expect(text).toContain('sum(sales)');
    expect(text).toContain('North');
    expect(text).toContain('South');
    expect(text).toContain('Laptop');
    expect(text).toContain('Mouse');
    expect(text).toContain('150'); // North + Laptop (100 + 50)
    expect(text).toContain('50'); // North + Mouse
    expect(table.getPivotResult()?.getValue(['North'], ['Laptop'], 'sales', 'sum')).toBe(150);
  });

  it('renders an empty shell when no pivot result is active', () => {
    const table = new SmartTable({ columns, data: sales });
    const view = new PivotView({ table });
    document.body.appendChild(view.element);
    expect(view.element.querySelector('table')?.textContent?.trim()).toBe('');
  });

  it('re-renders when the pivot config changes', () => {
    const table = new SmartTable({ columns, data: sales });
    table.pivot({
      rows: ['region'],
      columns: [],
      values: [{ field: 'sales', aggregation: 'sum' }],
    });
    const view = new PivotView({ table });
    document.body.appendChild(view.element);
    expect(tableText(view.element)).toContain('200'); // North total (100 + 50 + 50)

    table.clearPivot();
    view.render();
    expect(view.element.querySelector('table')?.textContent?.trim()).toBe('');
  });
});

describe('DOMRenderer pivot integration', () => {
  it('swaps the grid for the pivot view and back', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    const { table, getView } = mount(target);

    // Normal grid first.
    expect(getView()?.classList.contains('st-scroll')).toBe(true);
    expect(getView()?.classList.contains('st-pivot')).toBe(false);

    // Pivot replaces the grid.
    table.pivot({
      rows: ['region'],
      columns: ['product'],
      values: [{ field: 'sales', aggregation: 'sum' }],
    });
    const pivot = getView();
    expect(pivot?.classList.contains('st-pivot')).toBe(true);
    expect(pivot?.textContent).toContain('sum(sales)');
    expect(pivot?.textContent).toContain('150');

    // Clearing the pivot restores the grid.
    table.clearPivot();
    const restored = getView();
    expect(restored?.classList.contains('st-scroll')).toBe(true);
    expect(restored?.classList.contains('st-pivot')).toBe(false);
  });

  it('mounts into the pivot view directly when a result is already active', () => {
    const table = new SmartTable({ columns, data: sales });
    table.pivot({
      rows: ['region'],
      columns: [],
      values: [{ field: 'sales', aggregation: 'avg' }],
    });
    const target = document.createElement('div');
    document.body.appendChild(target);
    table.mount(target);
    const pivot = target.querySelector('.st-viewport .st-pivot');
    expect(pivot).not.toBeNull();
    expect((pivot as HTMLElement).textContent).toContain('66.6'); // North avg (200 / 3)
  });
});
