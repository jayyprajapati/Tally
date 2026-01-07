/**
 * Shared Selector component.
 * Pressable-based selector that opens modal/bottom sheet.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';

interface SelectorProps extends Omit<PressableProps, 'children' | 'style'> {
    label?: string;
    value: string;
    placeholder?: string;
    style?: StyleProp<ViewStyle>;
}

export function Selector({ label, value, placeholder, style, ...props }: SelectorProps) {
    const displayValue = value || placeholder || 'Select';
    const isPlaceholder = !value;

    return (
        <Pressable style={[styles.container, style]} {...props}>
            <View style={styles.content}>
                {label ? (
                    <Text variant="caption" color={colors.textMuted} style={styles.label}>
                        {label}
                    </Text>
                ) : null}
                <Text
                    variant="body"
                    color={isPlaceholder ? colors.textMuted : colors.textPrimary}
                    style={styles.value}
                >
                    {displayValue}
                </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.backgroundPrimary,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    content: {
        flex: 1,
        gap: 2,
    },
    label: {
        fontWeight: '600',
    },
    value: {
        fontWeight: '600',
    },
});

export default Selector;
