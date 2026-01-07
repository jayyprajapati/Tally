import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CredentialReveal from '@/components/credential-reveal';
import { Credential, getAllCredentials, maskCredentialValue } from '@/lib/db/credentials';
import { OneTimeItem, addOneTimeItem, getAllOneTimeItems } from '@/lib/db/onetime-items';
import {
  Subscription,
  deleteSubscription,
  getAllSubscriptions,
} from '@/lib/db/subscriptions';
import { colors, spacing, typography } from '@/theme';

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatDate = (value: string | Date) =>
  (value instanceof Date ? value.toISOString() : new Date(value).toISOString()).slice(0, 10);

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const billingTypes: Subscription['billingType'][] = ['weekly', 'monthly', 'yearly', 'lifetime'];
const statuses: Subscription['status'][] = ['active', 'wishlist'];

export default function SubscriptionsScreen() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [oneTimeItems, setOneTimeItems] = useState<OneTimeItem[]>([]);
  const defaultFilters = useMemo(
    () => ({
      categories: [] as string[],
      billingType: 'all',
      status: 'active',
      credential: 'all' as string,
      accessType: 'all' as 'all' | Subscription['accessType'],
    }),
    [],
  );
  const [filters, setFilters] = useState(defaultFilters);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [oneTimeModalVisible, setOneTimeModalVisible] = useState(false);
  const [oneTimeSubmitting, setOneTimeSubmitting] = useState(false);
  const [oneTimeName, setOneTimeName] = useState('');
  const [oneTimePlatform, setOneTimePlatform] = useState('');
  const [oneTimeCategory, setOneTimeCategory] = useState<string>('General');
  const [oneTimeAmount, setOneTimeAmount] = useState('');
  const [oneTimeDate, setOneTimeDate] = useState<Date>(new Date());
  const [showOneTimeDatePicker, setShowOneTimeDatePicker] = useState(false);
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

  const loadOneTimeItems = useCallback(async () => {
    const list = await getAllOneTimeItems();
    setOneTimeItems(list);
  }, []);

  const loadCredentials = useCallback(async () => {
    const list = await getAllCredentials();
    setCredentials(list);
  }, []);

  useEffect(() => {
    loadSubscriptions();
    loadCredentials();
    loadOneTimeItems();
  }, [loadSubscriptions, loadCredentials, loadOneTimeItems]);

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
      loadCredentials();
      loadOneTimeItems();
    }, [loadSubscriptions, loadCredentials, loadOneTimeItems]),
  );

  const credentialMap = useMemo(() => {
    const map: Record<string, Credential> = {};
    credentials.forEach((cred) => {
      map[cred.id] = cred;
    });
    return map;
  }, [credentials]);

  const filteredItems = useMemo(() => {
    const categoryFilters = filters.categories ?? [];
    return items.filter((item) => {
      const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(item.category);
      const matchesBilling = filters.billingType === 'all' || item.billingType === filters.billingType;
      const matchesStatus = filters.status === 'all' || item.status === filters.status;
      const matchesCredential =
        filters.credential === 'all'
          ? true
          : filters.credential === 'none'
            ? !item.linkedCredentialId
            : item.linkedCredentialId === filters.credential;
      const matchesAccessType = filters.accessType === 'all' || item.accessType === filters.accessType;

      return matchesCategory && matchesBilling && matchesStatus && matchesCredential && matchesAccessType;
    });
  }, [filters, items]);

  const resetFilters = () => {
    setFilters(defaultFilters);
    setDraftFilters(defaultFilters);
  };

  useEffect(() => {
    setDraftFilters({
      ...filters,
      categories: filters.categories ?? [],
    });
  }, [filters]);

  const isDefaultFilters = useMemo(
    () =>
      (filters.categories ?? []).length === 0 &&
      filters.billingType === defaultFilters.billingType &&
      filters.status === defaultFilters.status &&
      filters.credential === defaultFilters.credential &&
      filters.accessType === defaultFilters.accessType,
    [defaultFilters, filters],
  );

  const handleOpenEdit = (item: Subscription) => {
    router.push({ pathname: '/add-subscription', params: { id: String(item.id), mode: 'edit' } });
  };

  const handleAdd = () => {
    router.push('/add-subscription');
  };

  const handleOpenOneTime = () => {
    resetOneTimeForm();
    setOneTimeModalVisible(true);
  };

  const resetOneTimeForm = () => {
    setOneTimeName('');
    setOneTimePlatform('');
    setOneTimeCategory('General');
    setOneTimeAmount('');
    setOneTimeDate(new Date());
    setShowOneTimeDatePicker(false);
  };

  const handleSaveOneTime = async () => {
    if (oneTimeSubmitting) return;
    if (!oneTimeName.trim()) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }
    if (!oneTimePlatform.trim()) {
      Alert.alert('Platform required', 'Please enter the platform.');
      return;
    }

    const parsedAmount = parseFloat(oneTimeAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Amount required', 'Enter an amount greater than 0.');
      return;
    }

    const payload: OneTimeItem = {
      id: Date.now().toString(),
      name: oneTimeName.trim(),
      platform: oneTimePlatform.trim(),
      category: oneTimeCategory,
      amount: parsedAmount,
      date: oneTimeDate.toISOString(),
    };

    setOneTimeSubmitting(true);
    try {
      await addOneTimeItem(payload);
      await loadOneTimeItems();
      resetOneTimeForm();
      setOneTimeModalVisible(false);
    } finally {
      setOneTimeSubmitting(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    await deleteSubscription(id);
    await loadSubscriptions();
  };

  const renderItem = ({ item }: { item: Subscription }) => {
    const meta = categoryMeta[(item.category as CategoryKey) ?? 'Other'] ?? categoryMeta.Other;
    const isLifetime = item.billingType === 'lifetime';
    const isUserPaying = item.userPaying !== false;
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
            {!isLifetime && isUserPaying ? <Text style={styles.amount}>{formatCurrency(item.amount)}</Text> : null}
            <View style={styles.badgeRow}>
              <View style={[styles.categoryBadge, { backgroundColor: `${meta.color}22` }]}>
                <Text style={[styles.categoryText, { color: meta.color }]}>{item.category}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={[styles.statusText, { color: statusTextColor }]}>
                  {item.status === 'active' ? 'Active' : 'Wishlist'}
                </Text>
              </View>
              {item.accessType === 'shared' ? (
                <View style={styles.sharedBadge}>
                  <Text style={styles.sharedText}>
                    {isUserPaying ? 'Shared' : 'Shared (Not Paid by You)'}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.billingBadge, isLifetime && styles.lifetimeBadge]}>
                <Text style={[styles.billingText, isLifetime && styles.lifetimeText]}>
                  {item.billingType}
                </Text>
              </View>
            </View>
            {!isUserPaying && item.accessType === 'shared' ? (
              <Text style={styles.sharedNote}>Shared (Not Paid by You) — excluded from spend totals</Text>
            ) : null}
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
        <View style={styles.topActionsRight}>
          {!isDefaultFilters ? (
            <Pressable onPress={resetFilters} style={styles.resetInline} hitSlop={8}>
              <Text style={styles.resetInlineText}>Reset</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.filterButton}
            onPress={() => {
              setDraftFilters(filters);
              setFilterModalVisible(true);
            }}
          >
            <Ionicons name="filter" size={16} color="#111827" />
            <Text style={styles.filterButtonText}>Filters</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filteredItems}
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
        ListFooterComponent={
          <View style={styles.oneTimeSectionWrapper}>
            <Text style={styles.oneTimeTitle}>One-time items</Text>
            {oneTimeItems.length ? (
              <View style={styles.oneTimeList}>
                {oneTimeItems.map((item) => (
                  <View key={item.id} style={styles.oneTimeCard}>
                    <View style={styles.oneTimeHeader}>
                      <View>
                        <Text style={styles.oneTimeName}>{item.name}</Text>
                        <Text style={styles.oneTimeMeta}>{item.platform} • {item.category}</Text>
                      </View>
                      <Text style={styles.oneTimeAmount}>{formatCurrency(item.amount)}</Text>
                    </View>
                    <Text style={styles.oneTimeDate}>{formatDate(item.date)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.oneTimeEmpty}>No one-time items yet.</Text>
            )}
            <View style={{ height: 140 }} />
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.fabWrapper}>
        <View style={styles.fabRow}>
          <Pressable style={styles.fabSecondary} onPress={handleOpenOneTime}>
            <Text style={styles.fabIcon}>＋</Text>
            <Text style={styles.fabLabel}>Add One-Time</Text>
          </Pressable>
          <Pressable style={styles.fab} onPress={handleAdd}>
            <Text style={styles.fabIcon}>＋</Text>
            <Text style={styles.fabLabel}>Add subscription</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={oneTimeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          resetOneTimeForm();
          setOneTimeModalVisible(false);
        }}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Add One-Time</Text>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Name</Text>
                <TextInput
                  value={oneTimeName}
                  onChangeText={setOneTimeName}
                  placeholder="e.g. Movie ticket"
                  placeholderTextColor="#6b7280"
                  style={styles.sheetInput}
                />
              </View>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Platform</Text>
                <TextInput
                  value={oneTimePlatform}
                  onChangeText={setOneTimePlatform}
                  placeholder="e.g. Apple TV"
                  placeholderTextColor="#6b7280"
                  style={styles.sheetInput}
                />
              </View>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Category</Text>
                <View style={styles.chipRowWrap}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setOneTimeCategory(cat)}
                      style={[styles.filterChip, oneTimeCategory === cat && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, oneTimeCategory === cat && styles.filterChipTextActive]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Amount</Text>
                <TextInput
                  value={oneTimeAmount}
                  onChangeText={setOneTimeAmount}
                  placeholder="0.00"
                  placeholderTextColor="#6b7280"
                  keyboardType="decimal-pad"
                  style={styles.sheetInput}
                />
              </View>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Date</Text>
                <Pressable style={styles.sheetStatic} onPress={() => setShowOneTimeDatePicker(true)}>
                  <Text style={styles.sheetStaticText}>{formatDate(oneTimeDate)}</Text>
                </Pressable>
                {showOneTimeDatePicker ? (
                  <DateTimePicker
                    value={oneTimeDate}
                    mode="date"
                    display="spinner"
                    onChange={(event, date) => {
                      if (event.type === 'dismissed') {
                        setShowOneTimeDatePicker(false);
                        return;
                      }
                      if (date) setOneTimeDate(date);
                      setShowOneTimeDatePicker(false);
                    }}
                  />
                ) : null}
              </View>
            </ScrollView>
            <View style={styles.sheetActions}>
              <Pressable
                style={[styles.sheetButton, styles.sheetCancel]}
                onPress={() => {
                  resetOneTimeForm();
                  setOneTimeModalVisible(false);
                }}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.sheetButton, styles.sheetSave, oneTimeSubmitting && styles.submitDisabled]}
                onPress={handleSaveOneTime}
                disabled={oneTimeSubmitting}
              >
                <Text style={styles.sheetSaveText}>{oneTimeSubmitting ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Filters</Text>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Category</Text>
                <View style={styles.chipRowWrap}>
                  <Pressable
                    style={[styles.filterChip, draftFilters.categories.length === 0 && styles.filterChipActive]}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, categories: [] }))}
                  >
                    <Text style={[styles.filterChipText, draftFilters.categories.length === 0 && styles.filterChipTextActive]}>All</Text>
                  </Pressable>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      style={[styles.filterChip, draftFilters.categories.includes(cat) && styles.filterChipActive]}
                      onPress={() =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          categories: prev.categories.includes(cat)
                            ? prev.categories.filter((c) => c !== cat)
                            : [...prev.categories, cat],
                        }))
                      }
                    >
                      <Text style={[styles.filterChipText, draftFilters.categories.includes(cat) && styles.filterChipTextActive]}>{cat}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Billing type</Text>
                <View style={styles.chipRowWrap}>
                  <Pressable
                    style={[styles.filterChip, draftFilters.billingType === 'all' && styles.filterChipActive]}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, billingType: 'all' }))}
                  >
                    <Text style={[styles.filterChipText, draftFilters.billingType === 'all' && styles.filterChipTextActive]}>All</Text>
                  </Pressable>
                  {billingTypes.map((type) => (
                    <Pressable
                      key={type}
                      style={[styles.filterChip, draftFilters.billingType === type && styles.filterChipActive]}
                      onPress={() => setDraftFilters((prev) => ({ ...prev, billingType: type }))}
                    >
                      <Text style={[styles.filterChipText, draftFilters.billingType === type && styles.filterChipTextActive]}>{type}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Status</Text>
                <View style={styles.chipRowWrap}>
                  <Pressable
                    style={[styles.filterChip, draftFilters.status === 'all' && styles.filterChipActive]}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, status: 'all' }))}
                  >
                    <Text style={[styles.filterChipText, draftFilters.status === 'all' && styles.filterChipTextActive]}>All</Text>
                  </Pressable>
                  {statuses.map((stat) => (
                    <Pressable
                      key={stat}
                      style={[styles.filterChip, draftFilters.status === stat && styles.filterChipActive]}
                      onPress={() => setDraftFilters((prev) => ({ ...prev, status: stat }))}
                    >
                      <Text style={[styles.filterChipText, draftFilters.status === stat && styles.filterChipTextActive]}>
                        {stat === 'active' ? 'Active' : 'Wishlist'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Access Type</Text>
                <View style={styles.chipRowWrap}>
                  <Pressable
                    style={[styles.filterChip, draftFilters.accessType === 'all' && styles.filterChipActive]}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, accessType: 'all' }))}
                  >
                    <Text style={[styles.filterChipText, draftFilters.accessType === 'all' && styles.filterChipTextActive]}>All</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, draftFilters.accessType === 'owned' && styles.filterChipActive]}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, accessType: 'owned' }))}
                  >
                    <Text style={[styles.filterChipText, draftFilters.accessType === 'owned' && styles.filterChipTextActive]}>Owned</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, draftFilters.accessType === 'shared' && styles.filterChipActive]}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, accessType: 'shared' }))}
                  >
                    <Text style={[styles.filterChipText, draftFilters.accessType === 'shared' && styles.filterChipTextActive]}>Shared</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Linked account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
                  <Pressable
                    style={[styles.filterChip, draftFilters.credential === 'all' && styles.filterChipActive]}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, credential: 'all' }))}
                  >
                    <Text style={[styles.filterChipText, draftFilters.credential === 'all' && styles.filterChipTextActive]}>All</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.filterChip, draftFilters.credential === 'none' && styles.filterChipActive]}
                    onPress={() => setDraftFilters((prev) => ({ ...prev, credential: 'none' }))}
                  >
                    <Text style={[styles.filterChipText, draftFilters.credential === 'none' && styles.filterChipTextActive]}>None</Text>
                  </Pressable>
                  {credentials.map((cred) => (
                    <Pressable
                      key={cred.id}
                      style={[styles.filterChip, draftFilters.credential === cred.id && styles.filterChipActive]}
                      onPress={() => setDraftFilters((prev) => ({ ...prev, credential: cred.id }))}
                    >
                      <Text
                        style={[styles.filterChipText, draftFilters.credential === cred.id && styles.filterChipTextActive]}
                        numberOfLines={1}
                      >
                        {cred.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>
            <View style={styles.pickerActions}>
              <Pressable
                style={[styles.pickerButton, styles.clearButton]}
                onPress={() => {
                  setFilters(defaultFilters);
                  setDraftFilters(defaultFilters);
                  setFilterModalVisible(false);
                }}
              >
                <Text style={styles.clearText}>Clear Filters</Text>
              </Pressable>
              <Pressable
                style={[styles.pickerButton, styles.closeButton]}
                onPress={() => {
                  setFilters(draftFilters);
                  setFilterModalVisible(false);
                }}
              >
                <Text style={styles.closeText}>Apply Filters</Text>
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
    padding: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
  },
  list: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  topActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    backgroundColor: colors.backgroundPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  filterButtonText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resetInline: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  resetInlineText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  sharedNote: {
    marginTop: spacing.xs,
    ...typography.caption,
    color: colors.textMuted,
  },
  screenTitle: {
    ...typography.pageTitle,
    color: colors.textPrimary,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  filterGroup: {
    gap: spacing.sm,
  },
  filterLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chipRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  horizontalChips: {
    gap: spacing.sm,
    paddingRight: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
  },
  filterChipActive: {
    backgroundColor: colors.textPrimary,
  },
  filterChipText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filterChipTextActive: {
    color: colors.backgroundPrimary,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.backgroundPrimary,
    padding: spacing.lg,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    maxHeight: '85%',
  },
  sheetTitle: {
    ...typography.sectionTitle,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sheetBody: {
    gap: spacing.md,
  },
  sheetField: {
    gap: spacing.sm,
  },
  sheetLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sheetInput: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundPrimary,
    fontSize: 16,
  },
  sheetStatic: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundPrimary,
  },
  sheetStaticText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  sheetButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    alignItems: 'center',
  },
  sheetCancel: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sheetCancelText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sheetSave: {
    backgroundColor: colors.textPrimary,
  },
  sheetSaveText: {
    color: colors.backgroundPrimary,
    fontWeight: '700',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.backgroundPrimary,
    borderRadius: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalTitle: {
    ...typography.sectionTitle,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalBody: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  applyButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
  },
  applyButtonText: {
    color: colors.backgroundPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pickerButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  clearText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: colors.textPrimary,
  },
  closeText: {
    color: colors.backgroundPrimary,
    fontWeight: '700',
  },
  emptyState: {
    paddingVertical: spacing.xxl + spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyBody: {
    color: colors.textMuted,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.backgroundPrimary,
    shadowColor: colors.black,
    shadowOpacity: 0.04,
    shadowRadius: spacing.sm,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  lifetimeCard: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.backgroundPrimary,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  headerTextGroup: {
    flex: 1,
    gap: spacing.sm,
  },
  name: {
    ...typography.sectionTitle,
    fontWeight: '700',
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  categoryText: {
    ...typography.caption,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
  },
  sharedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
  },
  sharedText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  billingBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
  },
  billingText: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'capitalize',
    color: colors.textPrimary,
  },
  lifetimeBadge: {
    backgroundColor: colors.accentPrimary,
  },
  lifetimeText: {
    color: colors.backgroundPrimary,
    fontWeight: '800',
  },
  fabWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    alignItems: 'center',
  },
  fabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fabSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.textPrimary,
    borderRadius: 999,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: spacing.sm,
    shadowOffset: { width: 0, height: spacing.sm },
    elevation: 4,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.textPrimary,
    borderRadius: 999,
    shadowColor: colors.black,
    shadowOpacity: 0.15,
    shadowRadius: spacing.sm,
    shadowOffset: { width: 0, height: spacing.sm },
    elevation: 4,
  },
  fabIcon: {
    color: colors.backgroundPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  fabLabel: {
    color: colors.backgroundPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '700',
    ...typography.body,
  },
  editButton: {
    backgroundColor: colors.backgroundSecondary,
  },
  editText: {
    color: colors.accentPrimary,
  },
  deleteButton: {
    backgroundColor: colors.backgroundSecondary,
  },
  deleteText: {
    color: colors.textSecondary,
  },
  linkedRow: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  linkedLabel: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  linkedValue: {
    ...typography.body,
    color: colors.textPrimary,
  },
  oneTimeSectionWrapper: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  oneTimeTitle: {
    ...typography.sectionTitle,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
  },
  oneTimeList: {
    gap: spacing.sm,
  },
  oneTimeCard: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.backgroundPrimary,
    gap: spacing.sm,
  },
  oneTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  oneTimeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  oneTimeMeta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  oneTimeAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  oneTimeDate: {
    ...typography.caption,
    color: colors.textMuted,
  },
  oneTimeEmpty: {
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
});
