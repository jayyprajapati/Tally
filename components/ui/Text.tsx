/**
 * Shared Text component with typography tokens.
 * Provides consistent text styling across the app.
 */

import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';

import { colors } from '@/theme/colors';
import { typography, TypographyToken } from '@/theme/typography';

export type TextVariant = TypographyToken;

interface TextProps extends RNTextProps {
    variant?: TextVariant;
    color?: string;
    children: React.ReactNode;
}

export function Text({
    variant = 'body',
    color = colors.textPrimary,
    style,
    children,
    ...props
}: TextProps) {
    return (
        <RNText style={[typography[variant], { color }, style]} {...props}>
            {children}
        </RNText>
    );
}

export default Text;
