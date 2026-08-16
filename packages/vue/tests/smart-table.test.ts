// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
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

describe('<SmartTable />', () => {
  it('mounts the table and renders the rows', () => {
    const wrapper = mount(SmartTable, { props: { columns, data: rows } });
    expect(wrapper.text()).toContain('Laptop');
    expect(wrapper.text()).toContain('Mouse');
  });

  it('emits ready with the table instance', () => {
    const wrapper = mount(SmartTable, { props: { columns, data: rows } });
    const ready = wrapper.emitted('ready');
    expect(ready?.length).toBe(1);
    const table = ready![0]![0] as CoreTable;
    expect(table.getRowCount()).toBe(2);
  });

  it('syncs a new data prop into the table', async () => {
    const wrapper = mount(SmartTable, { props: { columns, data: rows } });
    expect(wrapper.text()).not.toContain('Keyboard');
    await wrapper.setProps({ data: [...rows, { id: 3, name: 'Keyboard', price: 80 }] });
    expect(wrapper.text()).toContain('Keyboard');
  });

  it('forwards core events and drives v-model:data', () => {
    const wrapper = mount(SmartTable, { props: { columns, data: rows } });
    const table = wrapper.emitted('ready')![0]![0] as CoreTable;
    table.sort('price', 'desc');
    expect(wrapper.emitted('sortChanged')).toBeTruthy();

    table.setData([{ id: 9, name: 'Speaker', price: 100 }]);
    expect(wrapper.emitted('update:data')).toBeTruthy();
    const rowsEmitted = wrapper.emitted('update:data')!.at(-1)![0] as DataRow[];
    expect(rowsEmitted).toHaveLength(1);
    expect(rowsEmitted[0]).toMatchObject({ name: 'Speaker' });
  });

  it('cleans up on unmount', () => {
    const wrapper = mount(SmartTable, { props: { columns, data: rows } });
    const table = wrapper.emitted('ready')![0]![0] as CoreTable;
    wrapper.unmount();
    expect(() => table.setData([])).toThrowError('destroyed');
  });
});

describe('useSmartTable', () => {
  it('mounts into the host ref and exposes the instance', () => {
    const Harness = defineComponent({
      setup() {
        const ctx = useSmartTable({ columns, data: rows });
        return { host: ctx.host, table: ctx.table };
      },
      template: `<div ref="host" data-testid="host" />`,
    });
    const wrapper = mount(Harness);
    const table = (wrapper.vm as unknown as { table: CoreTable | null }).table;
    expect(table?.getRowCount()).toBe(2);
    expect(wrapper.get('[data-testid="host"]').find('.st-root')).toBeTruthy();
  });

  it('setData replaces the rows', () => {
    let setData!: (rows: DataRow[]) => void;
    const Harness = defineComponent({
      setup() {
        const ctx = useSmartTable({ columns, data: rows });
        setData = ctx.setData;
        return { host: ctx.host };
      },
      template: `<div ref="host" />`,
    });
    const wrapper = mount(Harness);
    setData([{ id: 9, name: 'Speaker', price: 100 }]);
    expect(wrapper.text()).toContain('Speaker');
    expect(wrapper.text()).not.toContain('Laptop');
  });
});
