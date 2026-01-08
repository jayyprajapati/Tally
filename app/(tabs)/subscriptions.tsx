import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ListRenderItem, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SUBSCRIPTION_FILTERS_KEY } from '@/app/subscription-filters';
import CredentialReveal from '@/components/credential-reveal';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { RowItem } from '@/components/ui/RowItem';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Selector } from '@/components/ui/Selector';
import { Text } from '@/components/ui/Text';
import { Credential, getAllCredentials, maskCredentialValue } from '@/lib/db/credentials';
import { OneTimeItem, getAllOneTimeItems } from '@/lib/db/onetime-items';
import {
  Subscription,
  deleteSubscription,
  getAllSubscriptions,
} from '@/lib/db/subscriptions';
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
    }),
    [],
  );

  const [filters, setFilters] = useState<Filters>(defaultFilters);

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
            setFilters(JSON.parse(savedFilters));
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

  const isDefaultFilters = useMemo(
    () =>
      (filters.categories ?? []).length === 0 &&
      filters.billingType === defaultFilters.billingType &&
      filters.status === defaultFilters.status &&
      filters.credential === defaultFilters.credential &&
      filters.accessType === defaultFilters.accessType,
    [defaultFilters, filters],
  );

  const handleOpenFilters = () => {
    router.push({
      pathname: '/subscription-filters',
      params: { filters: JSON.stringify(filters) },
    });
  };

  const handleAddSubscription = () => {
    router.push('/add-subscription');
  };

  const handleAddOneTime = () => {
    router.push('/add-onetime');
  };

  const handleEdit = (item: Subscription) => {
    router.push({ pathname: '/add-subscription', params: { id: String(item.id), mode: 'edit' } });
  };

  const confirmDelete = (item: Subscription) => {
    Alert.alert('Delete subscription?', `Remove ${item.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => handleDelete(item.id),
      },
    ]);
  };

  const handleDelete = async (id: string | number) => {
    await deleteSubscription(id);
    await loadSubscriptions();
  };

  const resetFilters = async () => {
    setFilters(defaultFilters);
    await AsyncStorage.removeItem(SUBSCRIPTION_FILTERS_KEY);
  };

  const renderSubscription: ListRenderItem<Subscription> = ({ item }) => {
    const linkedCredential = item.linkedCredentialId ? credentialMap[item.linkedCredentialId] : undefined;
    const linkedMask = linkedCredential ? maskCredentialValue(linkedCredential) : 'None';
    const paying = item.userPaying !== false;
    const isLifetime = item.billingType === 'lifetime';

    const billingDescription = isLifetime
      ? 'Lifetime access'
      : item.billingType === 'weekly'
      ? 'Weekly'
      : item.billingType === 'monthly'
      ? 'Monthly'
      : 'Yearly';

    const subtitleParts = [item.category || 'Uncategorized', billingDescription, item.status === 'active' ? 'Active' : 'Wishlist'];
    const metaParts: string[] = [];

    if (item.accessType === 'shared') {
      metaParts.push(paying ? 'Shared (you pay)' : 'Shared (not paid by you)');
    }

    const subtitle = subtitleParts.filter(Boolean).join(' • ');
    const meta = metaParts.length ? metaParts.join(' • ') : undefined;

    return (
      <RowItem
        onPress={() => handleEdit(item)}
        onLongPress={() => confirmDelete(item)}
        title={item.name}
        amount={!isLifetime && paying ? formatCurrency(item.amount) : undefined}
        subtitle={subtitle}
        meta={meta}
        trailing={
          <View style={styles.rowActions}>
            <Pressable onPress={() => handleEdit(item)} hitSlop={8}>
              <Text variant="caption" color={colors.accentPrimary} style={styles.linkAction}>
                Edit
              </Text>
            </Pressable>
            <Pressable onPress={() => confirmDelete(item)} hitSlop={8}>
              <Text variant="caption" color={colors.textSecondary}>
                Delete
              </Text>
            </Pressable>
          </View>
        }
      >
        <View style={styles.credentialRow}>
          <Text variant="caption" color={colors.textMuted}>
            Linked account
          </Text>
          <CredentialReveal
            value={linkedCredential?.value}
            maskedValue={linkedMask}
            textStyle={styles.credentialValue}
            disabled={!linkedCredential}
          />
        </View>
      </RowItem>
    );
  };

  const renderOneTimeItem = ({ item }: { item: OneTimeItem }) => (
    <RowItem
      title={item.name}
      amount={formatCurrency(item.amount)}
      subtitle={[item.platform, item.category].filter(Boolean).join(' • ')}
      meta={formatDate(item.date)}
      disabled
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderSubscription}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refreshSubscriptions}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <View style={styles.pageHeader}>
              <Text variant="pageTitle" color={colors.textPrimary}>
                Subscriptions
              </Text>
              <View style={styles.headerButtons}>
                <SecondaryButton label="Add One-Time" onPress={handleAddOneTime} />
                <PrimaryButton label="Add Subscription" onPress={handleAddSubscription} />
              </View>
            </View>

            <View style={styles.filterBar}>
              <Selector
                label="Filters"
                value=""
                placeholder="Adjust filters"
                onPress={handleOpenFilters}
                style={styles.filterSelector}
              />
              {!isDefaultFilters ? (
                <Pressable onPress={resetFilters} hitSlop={8}>
                  <Text variant="caption" color={colors.accentPrimary} style={styles.resetLink}>
                    Clear
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <SectionHeader
              title={filters.status === 'wishlist' ? 'Wishlist' : 'Subscriptions'}
              action={
                loading ? (
                  <Text variant="caption" color={colors.textMuted}>
                    Updating…
                  </Text>
                ) : (
                  <Text variant="caption" color={colors.textSecondary}>
                    {filteredItems.length} items
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
                Add a subscription to get started.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <SectionHeader title="One-time items" />
            {oneTimeItems.length ? (
              <View style={styles.oneTimeList}>
                {oneTimeItems.map((item) => (
                  <View key={item.id}>
                    {renderOneTimeItem({ item })}
                    <Divider />
                  </View>
                ))}
              </View>
            ) : (
              <Text variant="body" color={colors.textMuted}>
                No one-time items recorded.
              </Text>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
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
    paddingBottom: spacing.xxl,
    backgroundColor: colors.backgroundPrimary,
  },
  headerArea: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  pageHeader: {
    gap: spacing.md,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  filterSelector: {
    flex: 1,
  },
  resetLink: {
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  credentialRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  credentialValue: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  footer: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  oneTimeList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.sm,
    overflow: 'hidden',
  },
  linkAction: {
    fontWeight: '600',
  },
});
