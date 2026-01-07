/**
 * Design Token: Colors
 * Centralized color palette for the entire app.
 * LIGHT MODE ONLY — no dark mode logic.
 */

export const colors = {
  // Background
  backgroundPrimary: '#FFFFFF',
  backgroundSecondary: '#F7F7F7',

  // Text
  textPrimary: '#111111',
  textSecondary: '#555555',
  textMuted: '#888888',

  // Accent (calm blue)
  accentPrimary: '#2563EB',

  // Borders / Dividers
  borderSubtle: '#E5E5E5',

  // Semantic: used for specific UI elements (mapped from core tokens)
  // These are derived and should still only use the core palette values
  white: '#FFFFFF',
  black: '#111111',
  modalBackdrop: 'rgba(0,0,0,0.35)',
} as const;

export type ColorToken = keyof typeof colors;
