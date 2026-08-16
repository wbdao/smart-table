import { SmartTableError, ERROR_CODES } from './errors';
import type { ResponsiveBreakpoints, ResponsiveBreakpointsInput } from '../types/options';

/** Default width thresholds when `responsive` is enabled without overrides. */
export const DEFAULT_BREAKPOINTS: ResponsiveBreakpoints = {
  mobile: 768,
  desktop: 1024,
};

/**
 * Fills in the default thresholds and validates the result.
 * `mobile` must be a positive number and `desktop` must be greater than
 * `mobile`; anything else throws a typed `INVALID_BREAKPOINTS` error.
 */
export function normalizeBreakpoints(input?: ResponsiveBreakpointsInput): ResponsiveBreakpoints {
  const breakpoints: ResponsiveBreakpoints = {
    mobile: input?.mobile ?? DEFAULT_BREAKPOINTS.mobile,
    desktop: input?.desktop ?? DEFAULT_BREAKPOINTS.desktop,
  };
  const isPositive = (n: number) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  if (!isPositive(breakpoints.mobile) || !isPositive(breakpoints.desktop)) {
    throw new SmartTableError(
      ERROR_CODES.INVALID_BREAKPOINTS,
      `Responsive breakpoints must be positive numbers, got mobile=${breakpoints.mobile}, desktop=${breakpoints.desktop}.`
    );
  }
  if (breakpoints.desktop <= breakpoints.mobile) {
    throw new SmartTableError(
      ERROR_CODES.INVALID_BREAKPOINTS,
      `Responsive "desktop" (${breakpoints.desktop}) must be greater than "mobile" (${breakpoints.mobile}).`
    );
  }
  return breakpoints;
}
