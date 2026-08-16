// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VirtualScroller } from '../src/features/virtualization/VirtualScroller';
import { ViewportManager } from '../src/features/virtualization/ViewportManager';
import { SmartTable } from '../src/core/SmartTable';
import { DOMRenderer } from '../src/ui/DOMRenderer';
import { ERROR_CODES } from '../src/core/errors';
import type { Column } from '../src/types';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
];

function makeRows(count: number) {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
}

function mountVirtual(count: number, rowHeight = 40) {
  const table = new SmartTable({
    columns,
    data: makeRows(count),
    virtualScroll: { enabled: true, rowHeight, overscan: 2 },
  });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const renderer = new DOMRenderer(table, { target: host, toolbar: false });
  renderer.mount();
  return { table, host, renderer };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('VirtualScroller (pure math)', () => {
  it('reports the full content height from the row count', () => {
    const scroller = new VirtualScroller({ rowHeight: 40, overscan: 10 });
    scroller.setTotalRows(100_000);
    scroller.setViewportHeight(480);
    expect(scroller.getTotalHeight()).toBe(4_000_000);
  });

  it('returns a window clamped into range with overscan', () => {
    const scroller = new VirtualScroller({ rowHeight: 40, overscan: 5 });
    scroller.setTotalRows(1000);
    scroller.setViewportHeight(400);
    scroller.setScrollTop(0);
    expect(scroller.getRange()).toEqual({ start: 0, end: 15 });

    scroller.setScrollTop(4000); // row 100
    const range = scroller.getRange();
    expect(range.start).toBe(95);
    expect(range.end).toBeLessThanOrEqual(1000);
    expect(range.end).toBeGreaterThan(105);
  });

  it('clamps overscan at the boundaries', () => {
    const scroller = new VirtualScroller({ rowHeight: 40, overscan: 50 });
    scroller.setTotalRows(10);
    scroller.setViewportHeight(200);
    scroller.setScrollTop(0);
    expect(scroller.getRange()).toEqual({ start: 0, end: 10 });
  });

  it('detects proximity to the end for infinite scroll', () => {
    const scroller = new VirtualScroller({ rowHeight: 40, overscan: 5 });
    scroller.setTotalRows(100);
    scroller.setViewportHeight(400);
    scroller.setScrollTop(0);
    expect(scroller.isNearEnd(5)).toBe(false);
    scroller.setScrollTop(100 * 40 - 400);
    expect(scroller.isNearEnd(5)).toBe(true);
  });

  it('scrolls to an index by computing its offset', () => {
    const scroller = new VirtualScroller({ rowHeight: 30, overscan: 0 });
    scroller.setTotalRows(100);
    scroller.setViewportHeight(300);
    expect(scroller.scrollToIndex(42)).toBe(42 * 30);
  });
});

describe('ViewportManager (DOM-bound)', () => {
  it('derives the range from the scroll container', () => {
    const element = document.createElement('div');
    const onChange = vi.fn();
    const manager = new ViewportManager({
      element,
      rowHeight: 40,
      overscan: 2,
      heightProvider: () => 480,
      onViewportChange: onChange,
    });
    manager.setTotalRows(1000);
    expect(onChange).toHaveBeenCalled();
    const firstRange = onChange.mock.calls[onChange.mock.calls.length - 1]![0];
    expect(firstRange.start).toBe(0);

    manager.handleScroll(4000); // row 100
    const last = onChange.mock.calls[onChange.mock.calls.length - 1]![0];
    expect(last.start).toBe(98);
    expect(last.end).toBeGreaterThanOrEqual(100);
    manager.destroy();
  });

  it('tracks the scroll position in pixels', () => {
    const element = document.createElement('div');
    const onChange = vi.fn();
    const manager = new ViewportManager({
      element,
      rowHeight: 40,
      overscan: 0,
      heightProvider: () => 480,
      onViewportChange: onChange,
    });
    manager.setTotalRows(1000);
    manager.handleScroll(8000);
    expect(manager.getScrollTop()).toBe(8000);
    manager.destroy();
  });
});

describe('TableView virtualization', () => {
  it('renders only a window of rows, not the full dataset', () => {
    const { host, table } = mountVirtual(1000, 40);
    // Viewport height in jsdom is 0, so the window is overscan only.
    const rendered = host.querySelectorAll('tbody tr.st-row');
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(1000);
    // The scroller knows the total even though the DOM is tiny.
    expect(table.getRows()).toHaveLength(1000);
  });

  it('frames the window with height spacers', () => {
    const { host } = mountVirtual(1000, 40);
    const spacers = host.querySelectorAll('tbody tr.st-virtual-spacer-row');
    expect(spacers.length).toBeGreaterThanOrEqual(1);
    for (const spacer of spacers) {
      const td = spacer.querySelector<HTMLElement>('td.st-virtual-spacer');
      expect(parseFloat(td?.style.height ?? '0')).toBeGreaterThan(0);
    }
  });

  it('emits viewportChanged with the visible window', async () => {
    const { table, host } = mountVirtual(500, 40);
    const listener = vi.fn();
    table.on('viewportChanged', listener);
    const scrollEl = host.querySelector<HTMLElement>('.st-scroll');
    expect(scrollEl).not.toBeNull();
    scrollEl?.dispatchEvent(new Event('scroll'));
    // jsdom rAF is timer-backed; flush it.
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(listener.mock.calls.length).toBeGreaterThan(0);
    const last = listener.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({
      startIndex: expect.any(Number),
      endIndex: expect.any(Number),
      scrollTop: expect.any(Number),
      viewportHeight: expect.any(Number),
    });
  });

  it('renders the empty state when there are no rows', () => {
    const { host } = mountVirtual(0, 40);
    expect(host.querySelector('tbody .st-empty')).not.toBeNull();
  });

  it('keeps virtualized rows interactive (selection via checkbox)', () => {
    const { host, table } = mountVirtual(50, 40);
    const first = host.querySelector<HTMLInputElement>('tbody tr.st-row input.st-select-row');
    expect(first).not.toBeNull();
    first?.click();
    expect(table.getSelectedRowIds()).toHaveLength(1);
  });

  it('updates the window when the dataset changes', () => {
    const { host, table } = mountVirtual(100, 40);
    expect(table.getRows()).toHaveLength(100);
    table.setData(makeRows(5));
    expect(host.querySelectorAll('tbody tr.st-row').length).toBeLessThanOrEqual(5);
  });
});

describe('virtualScroll option validation', () => {
  it('accepts true and object configs', () => {
    const a = new SmartTable({ columns, data: makeRows(3), virtualScroll: true });
    expect(a.getVirtualScrollOptions()).toEqual({ enabled: true });
    const b = new SmartTable({
      columns,
      data: makeRows(3),
      virtualScroll: { enabled: true, rowHeight: 60, overscan: 20 },
    });
    expect(b.getVirtualScrollOptions()?.rowHeight).toBe(60);
    expect(b.getVirtualScrollOptions()?.overscan).toBe(20);
  });

  it('returns null when disabled', () => {
    const table = new SmartTable({ columns, data: makeRows(3) });
    expect(table.getVirtualScrollOptions()).toBeNull();
  });

  it('rejects invalid row heights and overscan values', () => {
    expect(
      () => new SmartTable({ columns, virtualScroll: { rowHeight: 0, overscan: 10 } })
    ).toThrowError(ERROR_CODES.INVALID_VIRTUAL_SCROLL);
    expect(
      () => new SmartTable({ columns, virtualScroll: { rowHeight: 40, overscan: -1 } })
    ).toThrowError(ERROR_CODES.INVALID_VIRTUAL_SCROLL);
  });
});
