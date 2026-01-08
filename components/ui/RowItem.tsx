/**
 * Core list row used across subscription and wishlist lists.
 */

import React from 'react';
import { Pressable, PressableProps, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';

interface RowItemProps extends Omit<PressableProps, 'style'> {
  title: string;
  amount?: string;
  subtitle?: string;
  meta?: string;
  aside?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}

export function RowItem({
  title,
  amount,
  subtitle,
  meta,
  aside,
  trailing,
  children,
  disabled,
  ...pressableProps
}: RowItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      {...pressableProps}
      disabled={disabled}
      style={({ pressed }) => [
        styles.container,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <View style={styles.mainRow}>
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text variant="body" color={colors.textPrimary} style={styles.title}>
              {title}
            </Text>
            {amount ? (
              <Text variant="body" color={colors.textPrimary} style={styles.amount}>
                {amount}
              </Text>
            ) : null}
          </View>
          {subtitle ? (
            <Text variant="caption" color={colors.textSecondary} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text variant="caption" color={colors.textMuted} style={styles.meta}>
              {meta}
            </Text>
          ) : null}
          {children}
        </View>
        {aside ? <View style={styles.aside}>{aside}</View> : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    fontWeight: '600',
    flexShrink: 1,
  },
  amount: {
    fontWeight: '600',
  },
  subtitle: {
    fontWeight: '500',
  },
  meta: {
    fontWeight: '500',
  },
  aside: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  trailing: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
});

export default RowItem;
