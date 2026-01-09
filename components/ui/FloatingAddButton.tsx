import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { Text } from './Text';

type FloatingAddButtonProps = {
  onAdd: () => void;
};

export function FloatingAddButton({ onAdd }: FloatingAddButtonProps) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onAdd}
      style={({ pressed }) => [
        styles.button,
        { bottom: insets.bottom + spacing.xl + 36 },
        pressed ? styles.pressed : null,
      ]}>
      <Ionicons name="add" size={20} color={colors.backgroundPrimary} />
      <Text variant="body" color={colors.backgroundPrimary} style={styles.label}>
        ADD
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.xl,
    backgroundColor: colors.black,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
