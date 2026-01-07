/**
 * Design Token: Spacing
 * Centralized spacing scale for padding, margin, and gaps.
 */

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
} as const;

export type SpacingToken = keyof typeof spacing;
