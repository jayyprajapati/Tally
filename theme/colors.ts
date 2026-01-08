/**
 * Design Token: Colors
 * Centralized color palette for the entire app.
 * LIGHT MODE ONLY — no dark mode logic.
 */

export const colors = {
  // Background
  backgroundPrimary: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',

  // Accent — singular calm blue
  accentPrimary: '#325CF0',

  // Borders / Dividers
  borderSubtle: '#E2E8F0',

  // Semantic tokens derived from palette
  white: '#FFFFFF',
  black: '#0F172A',
  modalBackdrop: 'rgba(15, 23, 42, 0.35)',
} as const;

export type ColorToken = keyof typeof colors;
