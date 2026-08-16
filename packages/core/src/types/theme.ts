import type { ThemeName } from './modes';

/**
 * CSS custom properties that theme a SmartTable instance. Every key must be a
 * valid `--custom-property` and is applied onto the mount target (or the
 * `document.documentElement` when no container was provided).
 */
export type ThemeVariables = Record<string, string>;

/**
 * A fully resolved theme: a display name plus its CSS variable map. Built-in
 * themes (`light`, `dark`, `corporate`) are defined in `core/themes.ts` and
 * resolved from a {@link ThemeName}; custom themes are supplied by the user.
 */
export interface ThemeDefinition {
  name: string;
  variables: ThemeVariables;
}

/**
 * A user-supplied custom theme, accepted by `SmartTable.setTheme()`.
 * Setting `name` to an existing theme name overrides that theme's variables
 * for this instance.
 */
export interface CustomTheme extends ThemeDefinition {
  name: string;
  variables: ThemeVariables;
}

/** Value accepted by `SmartTable.setTheme()`. */
export type ThemeInput = ThemeName | CustomTheme;
