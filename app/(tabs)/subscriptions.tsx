import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CredentialReveal from '@/components/credential-reveal';
import { Credential, getAllCredentials, maskCredentialValue } from '@/lib/db/credentials';
import {
    Subscription,
    deleteSubscription,
    getAllSubscriptions,
    updateSubscription,
} from '@/lib/db/subscriptions';

const buildSampleSubscription = (): Subscription => ({
  id: Date.now().toString(),
  name: 'Sample Subscription',
  category: 'General',
  billingType: 'monthly',
  amount: 9.99,
  startDate: new Date().toISOString(),
  status: 'active',
  notes: 'Tap delete to remove',
});

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const billingTypes: Subscription['billingType'][] = ['monthly', 'yearly', 'lifetime'];
const statuses: Subscription['status'][] = ['active', 'wishlist'];

export default function SubscriptionsScreen() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    amount: '',
    category: 'General' as Subscription['category'],
    billingType: 'monthly' as Subscription['billingType'],
    status: 'active' as Subscription['status'],
    notes: '',
    startDate: new Date().toISOString().slice(0, 10),
    linkedCredentialId: undefined as string | undefined,
  });
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

  const handleAdd = () => {
    router.push('/add-subscription');
  };

  const handleDelete = async (id: string | number) => {
    await deleteSubscription(id);
    await loadSubscriptions();
  };

  const handleOpenEdit = (item: Subscription) => {
    setEditing(item);
  };

  useEffect(() => {
    if (editing) {
      setEditForm({
        name: editing.name,
        amount: editing.amount ? String(editing.amount) : '',
        category: editing.category,
        billingType: editing.billingType,
        status: editing.status,
        notes: editing.notes ?? '',
        startDate:
          typeof editing.startDate === 'string'
            ? editing.startDate.slice(0, 10)
            : editing.startDate.toISOString().slice(0, 10),
        linkedCredentialId: editing.linkedCredentialId,
      });
    }
  }, [editing]);

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) {
      return;
    }
    const numericAmount = parseFloat(editForm.amount);
    const needsAmount = editForm.billingType !== 'lifetime';
    if (needsAmount && (Number.isNaN(numericAmount) || numericAmount <= 0)) {
      return;
    }

    const updated: Subscription = {
      ...editing,
      name: editForm.name.trim() || editing.name,
      category: editForm.category,
      billingType: editForm.billingType,
      amount: needsAmount ? numericAmount : editing.amount,
      status: editForm.status,
      startDate: editForm.startDate,
      notes: editForm.notes.trim() ? editForm.notes.trim() : undefined,
      linkedCredentialId: editForm.linkedCredentialId,
    };

    await updateSubscription(updated);
    await loadSubscriptions();
    setEditing(null);
  };

  const closeEdit = () => setEditing(null);

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
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={loadSubscriptions}
        ListEmptyComponent={!loading ? <Text style={styles.message}>No subscriptions yet.</Text> : null}
        ListFooterComponent={<View style={{ height: 140 }} />}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.fabWrapper}>
        <Pressable style={styles.fab} onPress={handleAdd}>
          <Text style={styles.fabIcon}>＋</Text>
          <Text style={styles.fabLabel}>Add subscription</Text>
        </Pressable>
      </View>

      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={closeEdit}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Subscription</Text>
            {editing && (
              <>
                <Text style={styles.modalLabel}>Name</Text>
                <TextInput
                  value={editForm.name}
                  onChangeText={(text) => setEditForm((prev) => ({ ...prev, name: text }))}
                  style={styles.modalInput}
                  placeholder="Name"
                />

                <Text style={styles.modalLabel}>Amount</Text>
                <TextInput
                  value={editForm.amount}
                  onChangeText={(text) => setEditForm((prev) => ({ ...prev, amount: text }))}
                  style={styles.modalInput}
                  placeholder="0"
                  editable={editForm.billingType !== 'lifetime'}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.modalLabel}>Category</Text>
                <View style={styles.chipRow}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[styles.chip, editForm.category === cat && styles.chipSelected]}
                      onPress={() => setEditForm((prev) => ({ ...prev, category: cat as Subscription['category'] }))}
                    >
                      <Text style={[styles.chipText, editForm.category === cat && styles.chipTextSelected]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.modalLabel}>Billing</Text>
                <View style={styles.segmentRow}>
                  {billingTypes.map((type) => (
                    <Pressable
                      key={type}
                      style={[styles.segment, editForm.billingType === type && styles.segmentSelected]}
                      onPress={() => setEditForm((prev) => ({ ...prev, billingType: type }))}
                    >
                      <Text style={[styles.segmentText, editForm.billingType === type && styles.segmentTextSelected]}>
                        {type}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.modalLabel}>Status</Text>
                <View style={styles.segmentRow}>
                  {statuses.map((stat) => (
                    <Pressable
                      key={stat}
                      style={[styles.segment, editForm.status === stat && styles.segmentSelected]}
                      onPress={() => setEditForm((prev) => ({ ...prev, status: stat }))}
                    >
                      <Text style={[styles.segmentText, editForm.status === stat && styles.segmentTextSelected]}>
                        {stat}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.modalLabel}>Start date</Text>
                <TextInput
                  value={editForm.startDate}
                  onChangeText={(text) => setEditForm((prev) => ({ ...prev, startDate: text }))}
                  style={styles.modalInput}
                  placeholder="YYYY-MM-DD"
                />

                <Text style={styles.modalLabel}>Notes</Text>
                <TextInput
                  value={editForm.notes}
                  onChangeText={(text) => setEditForm((prev) => ({ ...prev, notes: text }))}
                  style={[styles.modalInput, styles.modalMultiline]}
                  multiline
                  placeholder="Optional"
                />
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, styles.modalSecondary]} onPress={closeEdit}>
                <Text style={styles.modalSecondaryText}>Close</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalPrimary]} onPress={handleSaveEdit}>
                <Text style={styles.modalPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  message: {
    textAlign: 'center',
    color: '#444',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 20,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#111827',
  },
  modalMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalSecondary: {
    backgroundColor: '#F3F4F6',
  },
  modalSecondaryText: {
    color: '#111827',
    fontWeight: '700',
  },
  modalPrimary: {
    backgroundColor: '#111827',
  },
  modalPrimaryText: {
    color: '#fff',
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
