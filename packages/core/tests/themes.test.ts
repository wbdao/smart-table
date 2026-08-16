// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SmartTable } from '../src/core/SmartTable';
import { BUILT_IN_THEMES } from '../src/core/themes';
import { ERROR_CODES } from '../src/core/errors';
import type { Column } from '../src/types';

const columns: Column[] = [{ field: 'name', title: 'Name' }];

beforeEach(() => {
  document.documentElement.removeAttribute('data-st-theme');
  for (const name of Object.keys(BUILT_IN_THEMES.light)) {
    document.documentElement.style.removeProperty(name);
  }
});

describe('SmartTable — themes (DOM)', () => {
  it('applies the theme attribute and variables on construction', () => {
    new SmartTable({ columns, theme: 'dark' });
    expect(document.documentElement.getAttribute('data-st-theme')).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--st-bg')).toBe(
      BUILT_IN_THEMES.dark['--st-bg']
    );
  });

  it('applies variables to the container when provided', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    new SmartTable({ columns, theme: 'corporate', container: host });
    expect(host.getAttribute('data-st-theme')).toBe('corporate');
    expect(host.style.getPropertyValue('--st-primary')).toBe(
      BUILT_IN_THEMES.corporate['--st-primary']
    );
    host.remove();
  });

  it('setTheme applies a custom theme and emits themeChanged', () => {
    const table = new SmartTable({ columns });
    const handler = vi.fn();
    table.on('themeChanged', handler);
    table.setTheme({
      name: 'neon',
      variables: { '--st-bg': '#111111', '--st-primary': '#00ff88' },
    });
    expect(table.getTheme()).toBe('neon');
    expect(document.documentElement.getAttribute('data-st-theme')).toBe('neon');
    expect(document.documentElement.style.getPropertyValue('--st-bg')).toBe('#111111');
    expect(table.getThemeVariables()['--st-primary']).toBe('#00ff88');
    expect(handler).toHaveBeenCalledWith({ name: 'neon', custom: true });
  });

  it('switching back to a built-in theme reports custom: false', () => {
    const table = new SmartTable({ columns });
    const handler = vi.fn();
    table.on('themeChanged', handler);
    table.setTheme('light');
    expect(handler).toHaveBeenCalledWith({ name: 'light', custom: false });
  });

  it('validates custom theme shapes', () => {
    const table = new SmartTable({ columns });
    expect(() => table.setTheme({ name: '', variables: {} })).toThrowError(
      ERROR_CODES.INVALID_THEME
    );
    expect(() => table.setTheme({ name: 'x' } as never)).toThrowError(ERROR_CODES.INVALID_THEME);
    expect(() => table.setTheme({ name: 'x', variables: [] } as never)).toThrowError(
      ERROR_CODES.INVALID_THEME
    );
  });

  it('throws for unknown built-in theme names', () => {
    const table = new SmartTable({ columns });
    expect(() => table.setTheme('neon' as never)).toThrowError(ERROR_CODES.INVALID_THEME);
  });

  it('duplicate preserves a custom theme on the clone', () => {
    const table = new SmartTable({ columns });
    table.setTheme({ name: 'neon', variables: { '--st-bg': '#222222' } });
    const clone = table.clone();
    expect(clone.getTheme()).toBe('neon');
    expect(clone.getThemeVariables()['--st-bg']).toBe('#222222');
  });
});
