import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ListRenderItem, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CredentialReveal from '@/components/credential-reveal';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { RowItem } from '@/components/ui/RowItem';
import { Selector } from '@/components/ui/Selector';
import { Text } from '@/components/ui/Text';
import { Credential, getAllCredentials, maskCredentialValue } from '@/lib/db/credentials';
import { Subscription, deleteSubscription, getAllSubscriptions } from '@/lib/db/subscriptions';
import { colors, spacing, typography } from '@/theme';

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

type Filters = {
  categories: string[];
  billingType: string;
  status: string;
  credential: string;
  accessType: 'all' | Subscription['accessType'];
};

const CATEGORY_OPTIONS = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const BILLING_OPTIONS: Subscription['billingType'][] = ['weekly', 'monthly', 'yearly', 'lifetime'];
const STATUS_OPTIONS: Subscription['status'][] = ['active', 'wishlist'];
const STORAGE_KEY = 'wishlist_filters';

export default function WishlistScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Subscription[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    categories: [],
    billingType: 'all',
    status: 'wishlist',
    credential: 'all',
    accessType: 'all',
  });
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  const defaultFilters = useMemo(
    () => ({
      categories: [],
      billingType: 'all',
      status: 'wishlist',
      credential: 'all',
      accessType: 'all',
    }),
    [],
  );

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const subs = await getAllSubscriptions();
      setItems(subs);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const subs = await getAllSubscriptions();
      setItems(subs);
      const creds = await getAllCredentials();
      setCredentials(creds);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadCredentials = useCallback(async () => {
    const list = await getAllCredentials();
    setCredentials(list);
  }, []);

  useEffect(() => {
    loadItems();
    loadCredentials();
  }, [loadItems, loadCredentials]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
      loadCredentials();
    }, [loadItems, loadCredentials]),
  );

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setFilters(JSON.parse(stored));
        }
      } catch {
        // ignore persistence errors
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filters)).catch(() => {
      // ignore persistence errors
    });
  }, [filters]);

  const credentialMap = useMemo(() => {
    const map: Record<string, Credential> = {};
    credentials.forEach((cred) => {
      map[cred.id] = cred;
    });
    return map;
  }, [credentials]);

  const wishlistItems = useMemo(() => items.filter((item) => item.status === 'wishlist'), [items]);

  const filteredItems = useMemo(() => {
    const categoryFilters = filters.categories ?? [];

    return wishlistItems.filter((item) => {
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
  }, [filters, wishlistItems]);

  const isDefaultFilters = useMemo(
    () =>
      (filters.categories ?? []).length === 0 &&
      filters.billingType === defaultFilters.billingType &&
      filters.status === defaultFilters.status &&
      filters.credential === defaultFilters.credential &&
      filters.accessType === defaultFilters.accessType,
    [defaultFilters, filters],
  );

  const handleAdd = () => {
    router.push('/add-subscription');
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
    await loadItems();
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const renderWishlist: ListRenderItem<Subscription> = ({ item }) => {
    const linkedCredential = item.linkedCredentialId ? credentialMap[item.linkedCredentialId] : undefined;
    const linkedMask = linkedCredential ? maskCredentialValue(linkedCredential) : 'None';
    const paying = item.userPaying !== false;
    const isLifetime = item.billingType === 'lifetime';

    const subtitleParts = [item.category || 'Uncategorized'];
    if (item.billingType === 'weekly') subtitleParts.push('Weekly');
    if (item.billingType === 'monthly') subtitleParts.push('Monthly');
    if (item.billingType === 'yearly') subtitleParts.push('Yearly');
    if (item.billingType === 'lifetime') subtitleParts.push('Lifetime access');
    if (item.accessType === 'shared') subtitleParts.push(paying ? 'Shared (you pay)' : 'Shared (not paid by you)');

    return (
      <RowItem
        onPress={() => handleEdit(item)}
        onLongPress={() => confirmDelete(item)}
        title={item.name}
        amount={!isLifetime && paying ? formatCurrency(item.amount) : undefined}
        subtitle={subtitleParts.filter(Boolean).join(' • ')}
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

  const renderFilterOption = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={styles.filterOption}>
      <View style={styles.filterIndicator}>{selected ? <View style={styles.filterIndicatorDot} /> : null}</View>
      <Text variant="body" color={colors.textPrimary}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderWishlist}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={styles.headerArea}>
            <Text variant="pageTitle" color={colors.textPrimary}>
              Wishlist
            </Text>
            <View style={styles.headerActions}>
              <Selector
                label="Filters"
                value=""
                placeholder="Adjust filters"
                onPress={() => setFiltersSheetOpen(true)}
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
            <View style={styles.headerButtons}>
              <SecondaryButton label="Refresh" onPress={refresh} />
              <PrimaryButton label="Add Subscription" onPress={handleAdd} />
            </View>
            <Text variant="caption" color={colors.textSecondary}>
              {filteredItems.length} saved items
            </Text>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text variant="sectionTitle" color={colors.textSecondary}>
                Nothing saved yet
              </Text>
              <Text variant="body" color={colors.textMuted}>
                Add subscriptions you are considering to track them here.
              </Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />

      <BottomSheet visible={filtersSheetOpen} onClose={() => setFiltersSheetOpen(false)} title="Filter wishlist">
        <View style={styles.sheetSection}>
          <Text variant="caption" color={colors.textSecondary} style={styles.sheetLabel}>
            Category
          </Text>
          {renderFilterOption(
            'All categories',
            filters.categories.length === 0,
            () => setFilters((prev) => ({ ...prev, categories: [] })),
          )}
          {CATEGORY_OPTIONS.map((cat) =>
            renderFilterOption(cat, filters.categories.includes(cat), () =>
              setFilters((prev) => ({
                ...prev,
                categories: prev.categories.includes(cat)
                  ? prev.categories.filter((value) => value !== cat)
                  : [...prev.categories, cat],
              })),
            ),
          )}
        </View>

        <View style={styles.sheetSection}>
          <Text variant="caption" color={colors.textSecondary} style={styles.sheetLabel}>
            Billing
          </Text>
          {renderFilterOption('All billing', filters.billingType === 'all', () =>
            setFilters((prev) => ({ ...prev, billingType: 'all' })),
          )}
          {BILLING_OPTIONS.map((value) =>
            renderFilterOption(value, filters.billingType === value, () =>
              setFilters((prev) => ({ ...prev, billingType: value })),
            ),
          )}
        </View>

        <View style={styles.sheetSection}>
          <Text variant="caption" color={colors.textSecondary} style={styles.sheetLabel}>
            Status
          </Text>
          {renderFilterOption('All statuses', filters.status === 'all', () =>
            setFilters((prev) => ({ ...prev, status: 'all' })),
          )}
          {STATUS_OPTIONS.map((value) =>
            renderFilterOption(value === 'wishlist' ? 'Wishlist' : 'Active', filters.status === value, () =>
              setFilters((prev) => ({ ...prev, status: value })),
            ),
          )}
        </View>

        <View style={styles.sheetSection}>
          <Text variant="caption" color={colors.textSecondary} style={styles.sheetLabel}>
            Access type
          </Text>
          {renderFilterOption('All access', filters.accessType === 'all', () =>
            setFilters((prev) => ({ ...prev, accessType: 'all' })),
          )}
          {renderFilterOption('Owned', filters.accessType === 'owned', () =>
            setFilters((prev) => ({ ...prev, accessType: 'owned' })),
          )}
          {renderFilterOption('Shared', filters.accessType === 'shared', () =>
            setFilters((prev) => ({ ...prev, accessType: 'shared' })),
          )}
        </View>

        <View style={styles.sheetSection}>
          <Text variant="caption" color={colors.textSecondary} style={styles.sheetLabel}>
            Linked account
          </Text>
          {renderFilterOption('All accounts', filters.credential === 'all', () =>
            setFilters((prev) => ({ ...prev, credential: 'all' })),
          )}
          {renderFilterOption('None linked', filters.credential === 'none', () =>
            setFilters((prev) => ({ ...prev, credential: 'none' })),
          )}
          {credentials.map((cred) =>
            renderFilterOption(cred.label, filters.credential === cred.id, () =>
              setFilters((prev) => ({ ...prev, credential: cred.id })),
            ),
          )}
        </View>

        <View style={styles.sheetActions}>
          <SecondaryButton label="Clear" onPress={resetFilters} style={styles.sheetButton} />
          <PrimaryButton label="Done" onPress={() => setFiltersSheetOpen(false)} style={styles.sheetButton} />
        </View>
      </BottomSheet>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButtons: {
    flexDirection: 'row',
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
  sheetSection: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  sheetLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sheetButton: {
    flex: 1,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  filterIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPrimary,
  },
  linkAction: {
    fontWeight: '600',
  },
});
