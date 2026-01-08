import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SecondaryButton } from '@/components/ui/Button';
import { RowItem } from '@/components/ui/RowItem';
import { Text } from '@/components/ui/Text';
import { colors, spacing } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="pageTitle" color={colors.textPrimary}>
          Settings
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          Control linked data and account access
        </Text>
      </View>

      <View style={styles.profileBlock}>
        <View style={styles.initials}>
          <Text variant="sectionTitle" color={colors.backgroundPrimary} style={styles.initialsText}>
            G
          </Text>
        </View>
        <View style={styles.profileCopy}>
          <Text variant="sectionTitle" color={colors.textPrimary} style={styles.profileName}>
            Guest
          </Text>
          <Text variant="caption" color={colors.textSecondary}>
            Manage saved credentials from one place.
          </Text>
        </View>
        <SecondaryButton label="Edit" onPress={() => router.push('/linked-accounts')} style={styles.profileButton} />
      </View>

      <View style={styles.listContainer}>
        <RowItem
          onPress={() => router.push('/linked-accounts')}
          title="Linked accounts"
          subtitle="Manage sign-in credentials"
          aside={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
        />
        <View style={styles.divider} />
        <RowItem
          onPress={() => router.push('/linked-cards')}
          title="Linked cards"
          subtitle="Update saved payment info"
          aside={<Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.xl,
  },
  header: {
    gap: spacing.xs,
  },
  profileBlock: {
    backgroundColor: colors.backgroundPrimary,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.md,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  initials: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontWeight: '700',
  },
  profileCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  profileName: {
    fontWeight: '700',
  },
  profileButton: {
    minWidth: 72,
  },
  listContainer: {
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
    backgroundColor: colors.backgroundPrimary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: spacing.sm,
  },
});
