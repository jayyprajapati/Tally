import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CredentialReveal from '@/components/credential-reveal';
import { Credential, getAllCredentials, maskCredentialValue } from '@/lib/db/credentials';
import {
    Subscription,
    deleteSubscription,
    getAllSubscriptions,
} from '@/lib/db/subscriptions';

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const billingTypes: Subscription['billingType'][] = ['monthly', 'yearly', 'lifetime'];
const statuses: Subscription['status'][] = ['active', 'wishlist'];

export default function SubscriptionsScreen() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const router = useRouter();

  const categoryMeta = useMemo(
    () => ({
      General: { color: '#6366F1', icon: '📦' },
      Entertainment: { color: '#F59E0B', icon: '🎬' },
      Productivity: { color: '#10B981', icon: '⚡️' },
      Fitness: { color: '#EF4444', icon: '💪' },
      Finance: { color: '#0EA5E9', icon: '💳' },
      Education: { color: '#8B5CF6', icon: '📚' },
      Other: { color: '#9CA3AF', icon: '🗂️' },
    } as const),
    [],
  );
  type CategoryKey = keyof typeof categoryMeta;

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllSubscriptions();
      setItems(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCredentials = useCallback(async () => {
    const list = await getAllCredentials();
    setCredentials(list);
  }, []);

  useEffect(() => {
    loadSubscriptions();
    loadCredentials();
  }, [loadSubscriptions, loadCredentials]);

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
      loadCredentials();
    }, [loadSubscriptions, loadCredentials]),
  );

  const credentialMap = useMemo(() => {
    const map: Record<string, Credential> = {};
    credentials.forEach((cred) => {
      map[cred.id] = cred;
    });
    return map;
  }, [credentials]);

  const handleOpenEdit = (item: Subscription) => {
    router.push({ pathname: '/edit-subscription', params: { id: String(item.id) } });
  };

  const handleAdd = () => {
    router.push('/add-subscription');
  };

  const handleDelete = async (id: string | number) => {
    await deleteSubscription(id);
    await loadSubscriptions();
  };

  const renderItem = ({ item }: { item: Subscription }) => {
    const meta = categoryMeta[(item.category as CategoryKey) ?? 'Other'] ?? categoryMeta.Other;
    const isLifetime = item.billingType === 'lifetime';
    const statusColor = item.status === 'active' ? '#DCFCE7' : '#E0F2FE';
    const statusTextColor = item.status === 'active' ? '#166534' : '#0F172A';
    const linkedCredential = item.linkedCredentialId ? credentialMap[item.linkedCredentialId] : undefined;
    const linkedMask = linkedCredential ? maskCredentialValue(linkedCredential) : 'None';

    return (
      <View style={[styles.card, isLifetime && styles.lifetimeCard]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconPill, { backgroundColor: `${meta.color}22` }]}> 
            <Text style={styles.icon}>{meta.icon}</Text>
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.name}>{item.name}</Text>
            {!isLifetime ? <Text style={styles.amount}>{formatCurrency(item.amount)}</Text> : null}
            <View style={styles.badgeRow}>
              <View style={[styles.categoryBadge, { backgroundColor: `${meta.color}22` }]}> 
                <Text style={[styles.categoryText, { color: meta.color }]}>{item.category}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}> 
                <Text style={[styles.statusText, { color: statusTextColor }]}>
                  {item.status === 'active' ? 'Active' : 'Wishlist'}
                </Text>
              </View>
              <View style={[styles.billingBadge, isLifetime && styles.lifetimeBadge]}> 
                <Text style={[styles.billingText, isLifetime && styles.lifetimeText]}>
                  {item.billingType}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionButton, styles.editButton]} onPress={() => handleOpenEdit(item)}>
            <Text style={[styles.actionText, styles.editText]}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(item.id)}>
            <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
          </Pressable>
        </View>

        <View style={styles.linkedRow}>
          <Text style={styles.linkedLabel}>Linked Account</Text>
          <CredentialReveal
            value={linkedCredential?.value}
            maskedValue={linkedMask}
            textStyle={styles.linkedValue}
            disabled={!linkedCredential}
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topActions}>
        <Text style={styles.screenTitle}>Subscriptions</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={loadSubscriptions}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No subscriptions</Text>
              <Text style={styles.emptyBody}>Add one to see it here.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 140 }} />}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.fabWrapper}>
        <Pressable style={styles.fab} onPress={handleAdd}>
          <Text style={styles.fabIcon}>＋</Text>
          <Text style={styles.fabLabel}>Add subscription</Text>
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
  },
  list: {
    paddingVertical: 12,
    gap: 12,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyBody: {
    color: '#6B7280',
  },
  card: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    gap: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  lifetimeCard: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  cardHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  headerTextGroup: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  billingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  billingText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
    color: '#0F172A',
  },
  lifetimeBadge: {
    backgroundColor: '#FEE2B3',
  },
  lifetimeText: {
    color: '#B45309',
    fontWeight: '800',
  },
  fabWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    alignItems: 'center',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#111',
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  fabLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '700',
    fontSize: 14,
  },
  editButton: {
    backgroundColor: '#EEF2FF',
  },
  editText: {
    color: '#312E81',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
  },
  deleteText: {
    color: '#B91C1C',
  },
  linkedRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  linkedLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  linkedValue: {
    fontSize: 14,
    color: '#111827',
  },
});
