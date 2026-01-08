import React from 'react';
import {
    Pressable,
    PressableProps,
    Text as RNText,
    StyleProp,
    StyleSheet,
    ViewStyle,
} from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type BaseButtonProps = Omit<PressableProps, 'style' | 'children'> & {
    label: string;
    style?: StyleProp<ViewStyle>;
};

function BaseButton({ label, style, disabled, ...props }: BaseButtonProps & { variant: 'primary' | 'secondary' }) {
    const { variant, ...rest } = props;
    const isPrimary = variant === 'primary';

    return (
        <Pressable
            accessibilityRole="button"
            disabled={disabled}
            style={({ pressed }) => [
                styles.base,
                isPrimary ? styles.primary : styles.secondary,
                pressed && !disabled ? styles.pressed : null,
                disabled ? styles.disabled : null,
                style,
            ]}
            {...rest}
        >
            <RNText style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>{label}</RNText>
        </Pressable>
    );
}

export function PrimaryButton(props: BaseButtonProps) {
    return <BaseButton variant="primary" {...props} />;
}

export function SecondaryButton(props: BaseButtonProps) {
    return <BaseButton variant="secondary" {...props} />;
}

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        borderRadius: spacing.sm,
        flexDirection: 'row',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    primary: {
        backgroundColor: colors.accentPrimary,
    },
    secondary: {
        backgroundColor: colors.backgroundPrimary,
        borderColor: colors.borderSubtle,
        borderWidth: 1,
    },
    pressed: {
        opacity: 0.75,
    },
    disabled: {
        opacity: 0.4,
    },
    label: {
        ...typography.body,
        fontWeight: '600',
    },
    labelPrimary: {
        color: colors.backgroundPrimary,
    },
    labelSecondary: {
        color: colors.textPrimary,
    },
});

export { BaseButtonProps };

