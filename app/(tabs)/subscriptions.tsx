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

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatDate = (value: string | Date) =>
  (value instanceof Date ? value.toISOString() : new Date(value).toISOString()).slice(0, 10);

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const billingTypes: Subscription['billingType'][] = ['monthly', 'yearly', 'lifetime'];
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
              {item.accessType === 'shared' ? (
                <View style={styles.sharedBadge}> 
                  <Text style={styles.sharedText}>Shared</Text>
                </View>
              ) : null}
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
                  style={styles.sheetInput}
                />
              </View>
              <View style={styles.sheetField}>
                <Text style={styles.sheetLabel}>Platform</Text>
                <TextInput
                  value={oneTimePlatform}
                  onChangeText={setOneTimePlatform}
                  placeholder="e.g. Apple TV"
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
    padding: 16,
    backgroundColor: '#f8f8f8',
  },
  list: {
    paddingVertical: 12,
    gap: 12,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 8,
  },
  topActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  resetInline: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resetInlineText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  filterGroup: {
    gap: 6,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  chipRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  horizontalChips: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  filterChipActive: {
    backgroundColor: '#111827',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    maxHeight: '85%',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  sheetBody: {
    gap: 12,
  },
  sheetField: {
    gap: 6,
  },
  sheetLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  sheetInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  sheetStatic: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  sheetStaticText: {
    fontSize: 16,
    color: '#111827',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  sheetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  sheetCancel: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sheetCancelText: {
    color: '#111827',
    fontWeight: '700',
  },
  sheetSave: {
    backgroundColor: '#111827',
  },
  sheetSaveText: {
    color: '#fff',
    fontWeight: '700',
  },
  submitDisabled: {
    opacity: 0.7,
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
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBody: {
    paddingVertical: 6,
    gap: 12,
  },
  applyButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  pickerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  clearText: {
    color: '#111827',
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: '#111827',
  },
  closeText: {
    color: '#fff',
    fontWeight: '700',
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
  sharedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E0E7FF',
  },
  sharedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#312E81',
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
  fabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  fabSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#111',
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
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
  oneTimeSectionWrapper: {
    marginTop: 12,
    gap: 10,
  },
  oneTimeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    paddingHorizontal: 4,
  },
  oneTimeList: {
    gap: 10,
  },
  oneTimeCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    gap: 6,
  },
  oneTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  oneTimeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  oneTimeMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  oneTimeAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  oneTimeDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  oneTimeEmpty: {
    color: '#6B7280',
    paddingHorizontal: 4,
  },
});
