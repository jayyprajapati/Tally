import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
            <View style={styles.rowIcon}><Ionicons name="mail" size={18} color="#111827" /></View>
            <Text style={styles.rowLabel}>Linked Accounts</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </Pressable>
        <Pressable style={styles.listRow} onPress={() => router.push('/linked-cards')}>
          <View style={styles.rowLeft}>
            <View style={styles.rowIcon}><Ionicons name="card" size={18} color="#111827" /></View>
            <Text style={styles.rowLabel}>Linked Cards</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6b7280" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f8f8',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  username: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  editPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
  },
  editPillText: {
    fontWeight: '700',
    color: '#111827',
  },
  listCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
});
