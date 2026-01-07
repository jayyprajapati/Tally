/**
 * Design Token: Typography
 * Centralized text styles for the entire app.
 * Single font family (system default).
 */

import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
});

export const typography = {
    pageTitle: {
        fontFamily,
        fontSize: 24,
        fontWeight: '700',
        lineHeight: 32,
    } as TextStyle,

    sectionTitle: {
        fontFamily,
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 24,
    } as TextStyle,

    body: {
        fontFamily,
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
    } as TextStyle,

    caption: {
        fontFamily,
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
    } as TextStyle,
} as const;

export type TypographyToken = keyof typeof typography;
