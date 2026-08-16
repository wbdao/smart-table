/**
 * Public theme utilities. The theme data and application logic live in
 * `core/themes.ts` (the core already owns the theme lifecycle); this module
 * re-exports them under the UI namespace for consumers who build custom
 * renderers and want to apply variables manually.
 */
export {
  BUILT_IN_THEMES,
  BUILT_IN_THEME_NAMES,
  DEFAULT_THEME_VARIABLES,
  applyThemeVariables,
  isBuiltInThemeName,
  resolveBuiltInTheme,
} from '../core/themes';
export type { CustomTheme, ThemeDefinition, ThemeInput, ThemeVariables } from '../types/theme';
