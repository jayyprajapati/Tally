/**
 * Shared Button component with primary/secondary variants.
 * Consistent styling using design tokens.
 */

import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
    variant?: ButtonVariant;
    title: string;
    style?: StyleProp<ViewStyle>;
}

export function Button({ variant = 'primary', title, style, disabled, ...props }: ButtonProps) {
    const isPrimary = variant === 'primary';

    return (
        <Pressable
            style={[
                styles.base,
                isPrimary ? styles.primary : styles.secondary,
                disabled && styles.disabled,
                style,
            ]}
            disabled={disabled}
            {...props}
        >
            <Text style={[styles.text, isPrimary ? styles.textPrimary : styles.textSecondary]}>
                {title}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primary: {
        backgroundColor: colors.textPrimary,
    },
    secondary: {
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        ...typography.body,
        fontWeight: '700',
    },
    textPrimary: {
        color: colors.backgroundPrimary,
    },
    textSecondary: {
        color: colors.textPrimary,
    },
});

export default Button;
