import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, FlatList, ListRenderItem, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SUBSCRIPTION_FILTERS_KEY } from '@/app/subscription-filters';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { Credential, getAllCredentials, maskCredentialValue } from '@/lib/db/credentials';
import { OneTimeItem, deleteOneTimeItem, getAllOneTimeItems } from '@/lib/db/onetime-items';
import { Subscription, deleteSubscription, getAllSubscriptions } from '@/lib/db/subscriptions';
import { colors, spacing, typography } from '@/theme';

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const formatDate = (value: string | Date) =>
  (value instanceof Date ? value.toISOString() : new Date(value).toISOString()).slice(0, 10);

type Filters = {
  categories: string[];
  billingType: string;
  status: string;
  credential: string;
  accessType: 'all' | Subscription['accessType'];
  itemType: 'all' | 'recurring' | 'oneTime';
  payment: 'all' | 'user' | 'notUser';
};

type ListEntry =
  | { kind: 'subscription'; item: Subscription }
  | { kind: 'oneTime'; item: OneTimeItem };

const CATEGORY_ICONS: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  Entertainment: 'play-outline',
  Productivity: 'flash-outline',
  Fitness: 'barbell-outline',
  Finance: 'wallet-outline',
  Education: 'book-outline',
  General: 'apps-outline',
  Other: 'ellipse-outline',
};

export default function SubscriptionsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Subscription[]>([]);
  const [oneTimeItems, setOneTimeItems] = useState<OneTimeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);

  const defaultFilters = useMemo<Filters>(
    () => ({
      categories: [],
      billingType: 'all',
      status: 'active',
      credential: 'all',
      accessType: 'all',
      itemType: 'all',
      payment: 'all',
    }),
    [],
  );

  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [infoItem, setInfoItem] = useState<ListEntry | null>(null);
  const filterScale = useRef(new Animated.Value(1)).current;

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAllSubscriptions();
      setItems(result);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSubscriptions = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getAllSubscriptions();
      setItems(result);
      const creds = await getAllCredentials();
      setCredentials(creds);
      const ones = await getAllOneTimeItems();
      setOneTimeItems(ones);
    } finally {
      setRefreshing(false);
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
    loadOneTimeItems();
    loadCredentials();
  }, [loadSubscriptions, loadOneTimeItems, loadCredentials]);

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
      loadOneTimeItems();
      loadCredentials();

      const loadFilters = async () => {
        try {
          const savedFilters = await AsyncStorage.getItem(SUBSCRIPTION_FILTERS_KEY);
          if (savedFilters) {
            const parsed = JSON.parse(savedFilters);
            setFilters((prev) => ({ ...prev, ...parsed }));
          }
        } catch {
          // ignore persisted filters errors
        }
      };

      loadFilters();
    }, [loadSubscriptions, loadOneTimeItems, loadCredentials]),
  );

  const credentialMap = useMemo(() => {
    const map: Record<string, Credential> = {};
    credentials.forEach((cred) => {
      map[cred.id] = cred;
    });
    return map;
  }, [credentials]);

  const filteredSubscriptions = useMemo(() => {
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
      const matchesType =
        filters.itemType === 'all'
          ? true
          : filters.itemType === 'recurring'
          ? item.billingType !== 'lifetime'
          : item.billingType === 'lifetime';
      const matchesPayment =
        filters.payment === 'all'
          ? true
          : filters.payment === 'user'
          ? item.userPaying !== false
          : item.userPaying === false;

      return (
        matchesCategory &&
        matchesBilling &&
        matchesStatus &&
        matchesCredential &&
        matchesAccessType &&
        matchesType &&
        matchesPayment
      );
    });
  }, [filters, items]);

  const filteredOneTimeItems = useMemo(() => {
    const categoryFilters = filters.categories ?? [];
    const allowType = filters.itemType === 'all' || filters.itemType === 'oneTime';
    const allowPayment = filters.payment !== 'notUser';
    const allowStatus = filters.status !== 'wishlist';

    return oneTimeItems.filter((item) => {
      if (!allowType || !allowPayment || !allowStatus) return false;
      const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(item.category);
      return matchesCategory;
    });
  }, [filters, oneTimeItems]);

  const visibleItems = useMemo(() => {
    const merged: ListEntry[] = [
      ...filteredSubscriptions.map((item) => ({ kind: 'subscription', item })),
      ...filteredOneTimeItems.map((item) => ({ kind: 'oneTime', item })),
    ];

    return merged.sort((a, b) => {
      const aDate = a.kind === 'subscription' ? new Date(a.item.startDate).getTime() : new Date(a.item.date).getTime();
      const bDate = b.kind === 'subscription' ? new Date(b.item.startDate).getTime() : new Date(b.item.date).getTime();
      return bDate - aDate;
    });
  }, [filteredOneTimeItems, filteredSubscriptions]);

  const isDefaultFilters = useMemo(
    () =>
      (filters.categories ?? []).length === 0 &&
      filters.billingType === defaultFilters.billingType &&
      filters.status === defaultFilters.status &&
      filters.credential === defaultFilters.credential &&
      filters.accessType === defaultFilters.accessType &&
      filters.itemType === defaultFilters.itemType &&
      filters.payment === defaultFilters.payment,
    [defaultFilters, filters],
  );

  const handleOpenFilters = () => {
    Animated.sequence([
      Animated.timing(filterScale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(filterScale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push({
        pathname: '/subscription-filters',
        params: { filters: JSON.stringify(filters) },
      });
    });
  };

  const handleEdit = (item: Subscription) => {
    router.push({ pathname: '/add-subscription', params: { id: String(item.id), mode: 'edit' } });
  };

  const handleEditOneTime = (item: OneTimeItem) => {
    router.push({ pathname: '/add-onetime', params: { item: JSON.stringify(item) } });
  };

  const resetFilters = async () => {
    setFilters({ ...defaultFilters });
    await AsyncStorage.removeItem(SUBSCRIPTION_FILTERS_KEY);
  };

  const confirmDeleteEntry = (entry: ListEntry) => {
    const name = entry.item.name;
    Alert.alert('Delete item?', `Remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteEntry(entry) },
    ]);
  };

  const handleDeleteEntry = async (entry: ListEntry) => {
    if (entry.kind === 'subscription') {
      await deleteSubscription(entry.item.id);
      await loadSubscriptions();
      return;
    }

    await deleteOneTimeItem(entry.item.id);
    await loadOneTimeItems();
  };

  const renderListItem: ListRenderItem<ListEntry> = ({ item }) => {
    const subscription = item.kind === 'subscription' ? item.item : null;
    const oneTime = item.kind === 'oneTime' ? item.item : null;
    const linkedCredential = subscription?.linkedCredentialId
      ? credentialMap[subscription.linkedCredentialId]
      : undefined;
    const paying = subscription ? subscription.userPaying !== false : true;
    const isOneTime = item.kind === 'oneTime' || subscription?.billingType === 'lifetime';
    const amountValue = subscription ? subscription.amount : oneTime?.amount ?? 0;
    const shouldShowAmount = paying && amountValue > 0;
    const amount = shouldShowAmount ? formatCurrency(amountValue) : undefined;
    const cycleLabel = isOneTime
      ? 'One-time'
      : subscription?.billingType === 'weekly'
      ? 'Weekly'
      : subscription?.billingType === 'monthly'
      ? 'Monthly'
      : 'Yearly';

    const ownershipLabel = subscription
      ? subscription.userPaying === false
        ? `Paid by ${subscription.sharedMembers?.[0] || 'someone else'}`
        : 'Own'
      : 'Own';

    const secondaryText = [
      subscription?.category || oneTime?.category || 'Uncategorized',
      cycleLabel,
      ownershipLabel,
    ]
      .filter(Boolean)
      .join(' • ');

    const category = subscription?.category || oneTime?.category || 'Other';
    const iconName = CATEGORY_ICONS[category] || 'apps-outline';

    return (
      <View style={styles.itemContainer}>
        <View style={styles.rowPrimary}>
          <Ionicons name={iconName} size={24} color={colors.textPrimary} />

          <View style={styles.primaryContent}>
            <View style={styles.titlePriceRow}>
              <View style={styles.nameRow}>
                <Text variant="body" color={colors.textPrimary} style={styles.title} numberOfLines={1}>
                  {subscription?.name || oneTime?.name}
                </Text>
                {isOneTime ? (
                  <View style={styles.oneTimeChip}>
                    <Text variant="caption" color="#854D0E" style={styles.oneTimeChipText}>
                      One-time
                    </Text>
                  </View>
                ) : null}
                <Pressable onPress={() => setInfoItem(item)} hitSlop={8} style={styles.infoButton}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
              {amount ? (
                <Text variant="body" color={colors.textPrimary} style={styles.amount}>
                  {amount}
                </Text>
              ) : null}
            </View>

            <View style={styles.rowSecondary}>
              <Text
                variant="caption"
                color={colors.textSecondary}
                numberOfLines={1}
                style={styles.secondaryText}>
                {secondaryText}
              </Text>

            </View>
          </View>
        </View>
      </View>
    );
  };

  const infoCredential =
    infoItem && infoItem.kind === 'subscription' && infoItem.item.linkedCredentialId
      ? credentialMap[infoItem.item.linkedCredentialId]
      : undefined;

  const linkedAccountValue =
    infoCredential && infoCredential.type !== 'card' ? maskCredentialValue(infoCredential) : 'None';

  const linkedCardValue =
    infoCredential && infoCredential.type === 'card' ? maskCredentialValue(infoCredential) : 'None';

  const infoMetadata = infoItem
    ? infoItem.kind === 'subscription'
      ? `${infoItem.item.category} • ${
          infoItem.item.billingType === 'lifetime' ? 'One-time' : infoItem.item.billingType
        } • ${infoItem.item.status}`
      : `${infoItem.item.platform} • ${formatDate(infoItem.item.date)}`
    : '';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={visibleItems}
        keyExtractor={(entry) =>
          entry.kind === 'subscription' ? `sub-${entry.item.id}` : `one-${entry.item.id}`
        }
        renderItem={renderListItem}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refreshSubscriptions}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <View style={styles.titleRow}>
              <Text variant="pageTitle" color={colors.textPrimary} style={styles.screenTitle}>
                SUBSCRIPTIONS
              </Text>
              <Animated.View style={{ transform: [{ scale: filterScale }] }}>
                <Pressable onPress={handleOpenFilters} style={styles.filterLink} hitSlop={8}>
                  <Ionicons name="funnel-outline" size={16} color={colors.accentPrimary} />
                  <Text variant="caption" color={colors.accentPrimary}>
                    Filters
                  </Text>
                </Pressable>
              </Animated.View>
            </View>
            {!isDefaultFilters ? (
              <Pressable onPress={resetFilters} hitSlop={8} style={styles.clearRow}>
                <Text variant="caption" color={colors.accentPrimary} style={styles.resetLink}>
                  Clear filters
                </Text>
              </Pressable>
            ) : null}

            <SectionHeader
              title={filters.status === 'wishlist' ? 'Wishlist' : 'Subscriptions'}
              action={
                loading ? (
                  <Text variant="caption" color={colors.textMuted}>
                    Updating…
                  </Text>
                ) : (
                  <Text variant="caption" color={colors.textSecondary}>
                    {visibleItems.length} items
                  </Text>
                )
              }
            />
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text variant="sectionTitle" color={colors.textSecondary}>
                Nothing to show yet
              </Text>
              <Text variant="body" color={colors.textMuted}>
                Use Add to create a subscription or one-time purchase.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={styles.footerSpacer} />}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={!!infoItem}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoItem(null)}>
        <View style={styles.infoBackdrop}>
          <Pressable style={styles.infoScrim} onPress={() => setInfoItem(null)} />
          <View style={styles.infoCard}>
            <Text variant="sectionTitle" color={colors.textPrimary} style={styles.infoTitle}>
              Details
            </Text>
            {infoItem ? (
              <>
                <View style={styles.infoRow}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Name
                  </Text>
                  <Text variant="body" color={colors.textPrimary} style={styles.infoValue} numberOfLines={1}>
                    {infoItem.item.name}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Linked account
                  </Text>
                  <Text variant="body" color={colors.textPrimary} style={styles.infoValue} numberOfLines={1}>
                    {linkedAccountValue}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Linked card
                  </Text>
                  <Text variant="body" color={colors.textPrimary} style={styles.infoValue} numberOfLines={1}>
                    {linkedCardValue}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text variant="caption" color={colors.textSecondary}>
                    Other metadata
                  </Text>
                  <Text variant="body" color={colors.textPrimary} style={styles.infoValue} numberOfLines={2}>
                    {infoMetadata}
                  </Text>
                </View>
                <View style={styles.infoActions}>
                  <Pressable
                    style={[styles.infoActionButton, styles.infoEdit]}
                    onPress={() => {
                      if (!infoItem) return;
                      if (infoItem.kind === 'subscription') {
                        handleEdit(infoItem.item);
                      } else {
                        handleEditOneTime(infoItem.item);
                      }
                      setInfoItem(null);
                    }}>
                    <Text variant="body" color={colors.backgroundPrimary} style={styles.infoActionText}>
                      Edit
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.infoActionButton, styles.infoDelete]}
                    onPress={() => {
                      if (infoItem) confirmDeleteEntry(infoItem);
                      setInfoItem(null);
                    }}>
                    <Text variant="body" color={colors.backgroundPrimary} style={styles.infoActionText}>
                      Delete
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl + 96,
    backgroundColor: colors.backgroundPrimary,
  },
  headerArea: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  filterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  clearRow: {
    alignItems: 'flex-end',
  },
  resetLink: {
    fontWeight: '600',
  },
  itemContainer: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  rowPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  primaryContent: {
    flex: 1,
    gap: spacing.xs,
  },
  titlePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  title: {
    fontWeight: '700',
    flexShrink: 1,
  },
  amount: {
    fontWeight: '700',
  },
  oneTimeChip: {
    backgroundColor: '#FEFCE8',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
  },
  oneTimeChipText: {
    fontWeight: '700',
  },
  infoButton: {
    paddingHorizontal: spacing.xs,
  },
  rowSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.md,
  },
  secondaryText: {
    flex: 1,
    ...typography.caption,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  footerSpacer: {
    height: spacing.xl,
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    justifyContent: 'flex-end',
  },
  infoScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  infoCard: {
    backgroundColor: colors.backgroundPrimary,
    padding: spacing.lg,
    borderTopLeftRadius: spacing.lg,
    borderTopRightRadius: spacing.lg,
    gap: spacing.md,
  },
  infoTitle: {
    textAlign: 'center',
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  infoValue: {
    textAlign: 'right',
    flex: 1,
  },
  infoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  infoActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
  },
  infoEdit: {
    backgroundColor: colors.accentPrimary,
  },
  infoDelete: {
    backgroundColor: '#DC2626',
  },
  infoActionText: {
    fontWeight: '700',
  },
});
