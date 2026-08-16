import type { ThemeDefinition, ThemeVariables } from '../types/theme';
import type { ThemeName } from '../types/modes';

/**
 * Default CSS variable values for the three built-in themes.
 *
 * The table shell, toolbar, cells, selection and card layout all read these
 * variables, so overriding them via {@link SmartTable.setTheme} (or by setting
 * the variables yourself under `[data-st-theme="..."]`) rethemees the whole
 * component without touching any component code.
 */
export const BUILT_IN_THEMES: Record<ThemeName, ThemeVariables> = {
  light: {
    '--st-bg': '#ffffff',
    '--st-text': '#0f172a',
    '--st-muted': '#64748b',
    '--st-border': '#e2e8f0',
    '--st-header-bg': '#f8fafc',
    '--st-header-text': '#334155',
    '--st-row-hover': '#f1f5f9',
    '--st-selected': '#dbeafe',
    '--st-selected-border': '#2563eb',
    '--st-focused': '#bfdbfe',
    '--st-primary': '#2563eb',
    '--st-primary-text': '#ffffff',
    '--st-danger': '#dc2626',
    '--st-toolbar-bg': '#f8fafc',
    '--st-input-bg': '#ffffff',
    '--st-shadow': 'rgba(15, 23, 42, 0.08)',
    '--st-radius': '6px',
  },
  dark: {
    '--st-bg': '#0f172a',
    '--st-text': '#e2e8f0',
    '--st-muted': '#94a3b8',
    '--st-border': '#1e293b',
    '--st-header-bg': '#111c31',
    '--st-header-text': '#cbd5e1',
    '--st-row-hover': '#16233c',
    '--st-selected': '#1e3a8a',
    '--st-selected-border': '#3b82f6',
    '--st-focused': '#1e40af',
    '--st-primary': '#3b82f6',
    '--st-primary-text': '#ffffff',
    '--st-danger': '#ef4444',
    '--st-toolbar-bg': '#111c31',
    '--st-input-bg': '#0f172a',
    '--st-shadow': 'rgba(0, 0, 0, 0.4)',
    '--st-radius': '6px',
  },
  corporate: {
    '--st-bg': '#ffffff',
    '--st-text': '#1f2937',
    '--st-muted': '#6b7280',
    '--st-border': '#d1d5db',
    '--st-header-bg': '#111827',
    '--st-header-text': '#f9fafb',
    '--st-row-hover': '#f3f4f6',
    '--st-selected': '#e0e7ff',
    '--st-selected-border': '#4f46e5',
    '--st-focused': '#c7d2fe',
    '--st-primary': '#4f46e5',
    '--st-primary-text': '#ffffff',
    '--st-danger': '#b91c1c',
    '--st-toolbar-bg': '#f9fafb',
    '--st-input-bg': '#ffffff',
    '--st-shadow': 'rgba(17, 24, 39, 0.1)',
    '--st-radius': '4px',
  },
};

/** Default thresholds used when a theme does not define a variable. */
export const DEFAULT_THEME_VARIABLES: ThemeVariables = BUILT_IN_THEMES.light;

/**
 * Applies a theme variable map onto an element (the mount target, falling
 * back to `document.documentElement`). Existing variables are overwritten;
 * no variable is removed so switching between themes is a cheap attribute
 * swap plus a handful of `style.setProperty` calls.
 */
export function applyThemeVariables(target: HTMLElement, variables: ThemeVariables): void {
  for (const [name, value] of Object.entries(variables)) {
    target.style.setProperty(name, value);
  }
}

/** Resolves the variable map for a built-in theme name. */
export function resolveBuiltInTheme(name: ThemeName): ThemeVariables {
  return BUILT_IN_THEMES[name];
}

/** All known built-in theme names. */
export const BUILT_IN_THEME_NAMES: readonly string[] = Object.keys(BUILT_IN_THEMES);

/** True when `name` refers to a built-in theme. */
export function isBuiltInThemeName(name: string): name is ThemeName {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_THEMES, name);
}

/** Resolves a `ThemeDefinition` (built-in lookup or user-provided object). */
export function resolveThemeDefinition(theme: ThemeDefinition): ThemeVariables {
  return theme.variables;
}
