// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { act } from 'react';
import { SmartTable } from '../src/SmartTable';
import { useSmartTable } from '../src/useSmartTable';
import type { Column, DataRow, SmartTable as CoreTable } from '@smart-table/core';

const columns: Column[] = [
  { field: 'id', title: 'ID', type: 'number' },
  { field: 'name', title: 'Name', type: 'string' },
  { field: 'price', title: 'Price', type: 'number' },
];

const rows: DataRow[] = [
  { id: 1, name: 'Laptop', price: 1200 },
  { id: 2, name: 'Mouse', price: 25 },
];

afterEach(() => cleanup());

describe('<SmartTable />', () => {
  it('mounts the table and renders the rows', () => {
    render(<SmartTable columns={columns} data={rows} />);
    expect(screen.getByText('Laptop')).toBeTruthy();
    expect(screen.getByText('Mouse')).toBeTruthy();
    expect(screen.getAllByText('Name').length).toBeGreaterThan(0);
  });

  it('calls onReady with the table instance', () => {
    const ready = vi.fn();
    render(<SmartTable columns={columns} data={rows} onReady={ready} />);
    expect(ready).toHaveBeenCalledTimes(1);
    const table = ready.mock.calls[0]![0] as CoreTable;
    expect(table.getRowCount()).toBe(2);
  });

  it('syncs new data into the mounted table (controlled)', () => {
    const { rerender } = render(<SmartTable columns={columns} data={rows} />);
    expect(screen.queryByText('Keyboard')).toBeNull();

    const next = [...rows, { id: 3, name: 'Keyboard', price: 80 }];
    rerender(<SmartTable columns={columns} data={next} />);
    expect(screen.getByText('Keyboard')).toBeTruthy();
  });

  it('forwards core event handlers', () => {
    const onSort = vi.fn();
    let table!: CoreTable;
    render(
      <SmartTable
        columns={columns}
        data={rows}

        onReady={(t) => {
          table = t;
        }}
        eventHandlers={{ sortChanged: onSort }}
      />
    );
    act(() => table.sort('price', 'desc'));
    expect(onSort).toHaveBeenCalledTimes(1);
    expect(onSort.mock.calls[0]![0]).toMatchObject({ field: 'price', direction: 'desc' });
  });

  it('fires onChange on data-affecting events (controlled mode)', () => {
    const onChange = vi.fn();
    let table!: CoreTable;
    render(
      <SmartTable
        columns={columns}
        data={rows}

        onReady={(t) => {
          table = t;
        }}
        onChange={onChange}
      />
    );
    act(() => table.sort('price', 'desc'));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)![0]).toBe(table);
  });

  it('unmounts and destroys the table on cleanup', () => {
    const ready = vi.fn();
    const view = render(<SmartTable columns={columns} data={rows} onReady={ready} />);
    const table = ready.mock.calls[0]![0] as CoreTable;
    view.unmount();
    expect(() => table.setData([])).toThrowError('destroyed');
  });
});

describe('useSmartTable', () => {
  it('mounts into the ref element and exposes the instance', () => {
    let table!: CoreTable;
    function Harness() {
      const result = useSmartTable({ columns, data: rows });
      table = result.table;
      return <div ref={result.containerRef} data-testid="host" />;
    }
    render(<Harness />);
    expect(table.getRowCount()).toBe(2);
    const host = screen.getByTestId('host');
    expect(host.querySelectorAll('.st-root')).toHaveLength(1);
  });

  it('setData replaces the rows', () => {
    let setData!: (rows: DataRow[]) => void;
    function Harness() {
      const result = useSmartTable({ columns, data: rows });
      setData = result.setData;
      return <div ref={result.containerRef} />;
    }
    render(<Harness />);
    expect(screen.getByText('Laptop')).toBeTruthy();
    act(() => setData([{ id: 9, name: 'Speaker', price: 100 }]));
    expect(screen.getByText('Speaker')).toBeTruthy();
    expect(screen.queryByText('Laptop')).toBeNull();
  });
});
