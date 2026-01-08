/**
 * Section header with consistent typography and spacing.
 */

import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';

interface SectionHeaderProps extends ViewProps {
  title: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, action, style, ...props }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      <Text variant="sectionTitle" color={colors.textPrimary} style={styles.title}>
        {title}
      </Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  title: {
    fontWeight: '600',
  },
  action: {
    marginLeft: spacing.md,
  },
});

export default SectionHeader;
