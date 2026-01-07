import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>G</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.username}>Guest</Text>
          <Text style={styles.subtitle}>Manage linked accounts and cards</Text>
        </View>
        <Pressable style={styles.editPill} onPress={() => router.push('/linked-accounts')}>
          <Text style={styles.editPillText}>Edit</Text>
        </Pressable>
      </View>

      <View style={styles.listCard}>
        <Pressable style={styles.listRow} onPress={() => router.push('/linked-accounts')}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}><Ionicons name="mail" size={18} color={colors.textPrimary} /></View>
            <Text style={styles.rowLabel}>Linked Accounts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable style={styles.listRow} onPress={() => router.push('/linked-cards')}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}><Ionicons name="card" size={18} color={colors.textPrimary} /></View>
            <Text style={styles.rowLabel}>Linked Cards</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    gap: spacing.md,
  },
  title: {
    ...typography.pageTitle,
    color: colors.textPrimary,
  },
  profileCard: {
    backgroundColor: colors.backgroundPrimary,
    borderRadius: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.textPrimary,
  },
  avatarText: {
    color: colors.backgroundPrimary,
    fontWeight: '800',
    fontSize: typography.sectionTitle.fontSize,
  },
  username: {
    ...typography.sectionTitle,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  editPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.backgroundSecondary,
  },
  editPillText: {
    fontWeight: '700',
    color: colors.textPrimary,
    fontSize: typography.body.fontSize,
  },
  listCard: {
    backgroundColor: colors.backgroundPrimary,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
