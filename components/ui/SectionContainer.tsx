/**
 * Shared SectionContainer component.
 * Clean section wrapper with consistent styling.
 */

import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';

interface SectionContainerProps extends ViewProps {
    title?: string;
    children: React.ReactNode;
}

export function SectionContainer({ title, children, style, ...props }: SectionContainerProps) {
    return (
        <View style={[styles.container, style]} {...props}>
            {title ? (
                <Text variant="sectionTitle" style={styles.title}>
                    {title}
                </Text>
            ) : null}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.backgroundPrimary,
        borderRadius: spacing.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    title: {
        fontWeight: '700',
        marginBottom: spacing.sm,
    },
});

export default SectionContainer;
