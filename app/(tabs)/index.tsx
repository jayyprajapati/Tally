import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { Credential, getAllCredentials } from '@/lib/db/credentials';
import { OneTimeItem, getAllOneTimeItems } from '@/lib/db/onetime-items';
import { Subscription, getAllSubscriptions } from '@/lib/db/subscriptions';

const categoryMeta = {
  General: { color: '#6366F1' },
  Entertainment: { color: '#F59E0B' },
  Productivity: { color: '#10B981' },
  Fitness: { color: '#EF4444' },
  Finance: { color: '#0EA5E9' },
  Education: { color: '#8B5CF6' },
  Other: { color: '#9CA3AF' },
} as const;

type CategoryKey = keyof typeof categoryMeta;

type Slice = {
  category: string;
  value: number;
  color: string;
};

type SpendTab = 'overall' | 'monthly' | 'yearly';

type CategoryEntry =
  | { type: 'subscription'; item: Subscription; contribution: number }
  | { type: 'oneTime'; item: OneTimeItem; contribution: number };

const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const formatDate = (value: string | Date) =>
  (value instanceof Date ? value.toISOString() : new Date(value).toISOString()).slice(0, 10);

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});

const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

const INACTIVE_MONTHS = 6;


const DonutChart = ({ data, total, label }: { data: Slice[]; total: number; label: string }) => {
  const size = 200;
  const radius = size / 2 - 6;
  const innerRadius = 60;

  if (!data.length || total <= 0) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>No data</Text>
      </View>
    );
  }

  let cumulative = 0;

  return (
    <View style={styles.donutWrapper}>
      <Svg width={size} height={size}>
        {data.map((slice) => {
          const startAngle = cumulative;
          const angle = (slice.value / total) * Math.PI * 2;
          const endAngle = startAngle + angle;
          cumulative = endAngle;

          const start = polarToCartesian(size / 2, size / 2, radius, startAngle);
          const end = polarToCartesian(size / 2, size / 2, radius, endAngle);
          const largeArcFlag = angle > Math.PI ? 1 : 0;

          const d = [
            `M ${size / 2} ${size / 2}`,
            `L ${start.x} ${start.y}`,
            `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
            'Z',
          ].join(' ');

          return <Path key={slice.category} d={d} fill={slice.color} />;
        })}
        <Circle cx={size / 2} cy={size / 2} r={innerRadius} fill="#f8f8f8" />
        <SvgText
          x={size / 2}
          y={size / 2 - 4}
          fontSize={12}
          fontWeight="600"
          fill="#6b7280"
          textAnchor="middle">
          {label}
        </SvgText>
        <SvgText
          x={size / 2}
          y={size / 2 + 16}
          fontSize={16}
          fontWeight="800"
          fill="#0f172a"
          textAnchor="middle">
          {formatCurrency(total)}
        </SvgText>
      </Svg>
    </View>
  );
};

const getMonthsInYear = (startDate: string | Date, targetYear: number, stopDate?: string | Date | null): number => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const stop = stopDate ? (typeof stopDate === 'string' ? new Date(stopDate) : stopDate) : null;
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();

  if (startYear > targetYear) return 0;

  const stopYear = stop?.getFullYear();
  const stopMonth = stop?.getMonth();

  if (stop && stopYear !== undefined && stopYear < targetYear) return 0;

  const endMonth = stop && stopYear === targetYear ? stopMonth ?? 0 : 11;
  const effectiveStartMonth = startYear === targetYear ? startMonth : 0;
  const span = endMonth - effectiveStartMonth + 1;

  return Math.max(0, Math.min(span, 12));
};

const isSubscriptionActiveInMonth = (startDate: string | Date, targetYear: number, targetMonth: number, stopDate?: string | Date | null): boolean => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const stop = stopDate ? (typeof stopDate === 'string' ? new Date(stopDate) : stopDate) : null;
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();

  if (startYear > targetYear) return false;
  if (stop) {
    const stopYear = stop.getFullYear();
    const stopMonth = stop.getMonth();
    if (targetYear > stopYear) return false;
    if (targetYear === stopYear && targetMonth > stopMonth) return false;
  }
  if (startYear < targetYear) return true;
  if (startYear === targetYear && startMonth <= targetMonth) return true;

  return false;
};

const isSubscriptionActiveInYear = (startDate: string | Date, targetYear: number, stopDate?: string | Date | null): boolean => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const stop = stopDate ? (typeof stopDate === 'string' ? new Date(stopDate) : stopDate) : null;
  const startYear = start.getFullYear();
  const stopYear = stop?.getFullYear();
  if (stopYear !== undefined && targetYear > stopYear) return false;
  return startYear <= targetYear;
};

export default function DashboardScreen() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [oneTimeItems, setOneTimeItems] = useState<OneTimeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [includeWishlist, setIncludeWishlist] = useState(false);
  const [activeTab, setActiveTab] = useState<SpendTab>('overall');
  const [categoryModal, setCategoryModal] = useState<{ category: string; entries: CategoryEntry[] } | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllSubscriptions();
      setSubscriptions(data);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await getAllSubscriptions();
      setSubscriptions(data);
      const creds = await getAllCredentials();
      setCredentials(creds);
      const ones = await getAllOneTimeItems();
      setOneTimeItems(ones);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
      loadCredentials();
      loadOneTimeItems();
    }, [loadCredentials, loadOneTimeItems, loadSubscriptions]),
  );

  const analytics = useMemo(() => {
    const base = includeWishlist
      ? subscriptions
      : subscriptions.filter((sub) => sub.status === 'active');

    const oneTimeByYear = oneTimeItems.filter((item) => {
      const year = new Date(item.date).getFullYear();
      return year === selectedYear;
    });

    if (activeTab === 'overall') {
      const categoryTotals: Record<string, number> = {};
      let totalSpend = 0;

      base.forEach((sub) => {
        if (sub.billingType === 'lifetime') return;

        const stop = sub.hasStopDate ? sub.stopDate : null;

        let spend = 0;

        if (sub.billingType === 'monthly') {
          const months = getMonthsInYear(sub.startDate, selectedYear, stop);
          spend = sub.amount * months;
        } else if (sub.billingType === 'yearly') {
          const startYear = typeof sub.startDate === 'string' ? new Date(sub.startDate).getFullYear() : sub.startDate.getFullYear();
          const stopYear = stop
            ? (typeof stop === 'string' ? new Date(stop).getFullYear() : stop.getFullYear())
            : undefined;
          if (startYear === selectedYear && (stopYear === undefined || stopYear >= selectedYear)) {
            spend = sub.amount;
          }
        }

        if (spend > 0) {
          const key = sub.category || 'Other';
          categoryTotals[key] = (categoryTotals[key] ?? 0) + spend;
          totalSpend += spend;
        }
      });

      oneTimeByYear.forEach((item) => {
        const key = item.category || 'Other';
        categoryTotals[key] = (categoryTotals[key] ?? 0) + item.amount;
        totalSpend += item.amount;
      });

      const slices: Slice[] = Object.entries(categoryTotals)
        .filter(([, value]) => value > 0)
        .map(([category, value]) => ({
          category,
          value,
          color: categoryMeta[category as CategoryKey]?.color ?? categoryMeta.Other.color,
        }));

      return { slices, total: totalSpend };
    }

    if (activeTab === 'monthly') {
      const categoryTotals: Record<string, number> = {};
      let totalSpend = 0;

      base.forEach((sub) => {
        if (sub.billingType !== 'monthly') return;

        if (isSubscriptionActiveInMonth(sub.startDate, selectedYear, selectedMonth, sub.hasStopDate ? sub.stopDate : null)) {
          const key = sub.category || 'Other';
          categoryTotals[key] = (categoryTotals[key] ?? 0) + sub.amount;
          totalSpend += sub.amount;
        }
      });

      const slices: Slice[] = Object.entries(categoryTotals)
        .filter(([, value]) => value > 0)
        .map(([category, value]) => ({
          category,
          value,
          color: categoryMeta[category as CategoryKey]?.color ?? categoryMeta.Other.color,
        }));

      return { slices, total: totalSpend };
    }

    if (activeTab === 'yearly') {
      const categoryTotals: Record<string, number> = {};
      let totalSpend = 0;

      base.forEach((sub) => {
        if (sub.billingType !== 'yearly') return;

        if (isSubscriptionActiveInYear(sub.startDate, selectedYear, sub.hasStopDate ? sub.stopDate : null)) {
          const key = sub.category || 'Other';
          categoryTotals[key] = (categoryTotals[key] ?? 0) + sub.amount;
          totalSpend += sub.amount;
        }
      });

      const slices: Slice[] = Object.entries(categoryTotals)
        .filter(([, value]) => value > 0)
        .map(([category, value]) => ({
          category,
          value,
          color: categoryMeta[category as CategoryKey]?.color ?? categoryMeta.Other.color,
        }));

      return { slices, total: totalSpend };
    }

    return { slices: [], total: 0 };
  }, [activeTab, includeWishlist, oneTimeItems, selectedMonth, selectedYear, subscriptions]);

  const credentialMap = useMemo(() => {
    const map: Record<string, Credential> = {};
    credentials.forEach((cred) => {
      map[cred.id] = cred;
    });
    return map;
  }, [credentials]);

  const insights = useMemo(() => {
    const now = new Date();
    const categoryCount: Record<string, number> = {};
    const billingCount: Record<'monthly' | 'yearly' | 'lifetime', number> = {
      monthly: 0,
      yearly: 0,
      lifetime: 0,
    };
    const credentialUsage: Record<string, number> = {};
    const inactive: Subscription[] = [];

    subscriptions.forEach((sub) => {
      const categoryKey = sub.category || 'Other';
      categoryCount[categoryKey] = (categoryCount[categoryKey] ?? 0) + 1;
      billingCount[sub.billingType] = (billingCount[sub.billingType] ?? 0) + 1;

      if (sub.linkedCredentialId) {
        credentialUsage[sub.linkedCredentialId] = (credentialUsage[sub.linkedCredentialId] ?? 0) + 1;
      }

      const lastTouch = typeof sub.startDate === 'string' ? new Date(sub.startDate) : sub.startDate;
      if (monthsBetween(lastTouch, now) >= INACTIVE_MONTHS) {
        inactive.push(sub);
      }
    });

    const categoryCounts = Object.entries(categoryCount)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    const billingCounts = (['monthly', 'yearly', 'lifetime'] as const).map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      count: billingCount[key] ?? 0,
    }));

    const reusedAccounts = Object.entries(credentialUsage)
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, label: credentialMap[id]?.label ?? 'Linked account', count }))
      .sort((a, b) => b.count - a.count);

    return { categoryCounts, billingCounts, reusedAccounts, inactive, inactivityThreshold: INACTIVE_MONTHS };
  }, [credentialMap, subscriptions]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    let maxYear = currentYear;
    subscriptions.forEach((sub) => {
      const startYear = typeof sub.startDate === 'string' ? new Date(sub.startDate).getFullYear() : sub.startDate.getFullYear();
      maxYear = Math.max(maxYear, startYear);
      for (let y = startYear; y <= maxYear; y++) {
        years.add(y);
      }
    });
    oneTimeItems.forEach((item) => {
      const year = new Date(item.date).getFullYear();
      maxYear = Math.max(maxYear, year);
      years.add(year);
    });
    if (!years.size) years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [subscriptions, oneTimeItems, currentYear]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getTabLabel = () => {
    if (activeTab === 'overall') return `Overall Spend (${selectedYear})`;
    if (activeTab === 'monthly') return `Monthly Spend (${monthNames[selectedMonth]} ${selectedYear})`;
    if (activeTab === 'yearly') return `Yearly Spend (${selectedYear})`;
    return '';
  };

  const buildCategoryEntries = useCallback(
    (category: string) => {
      const base = includeWishlist
        ? subscriptions
        : subscriptions.filter((sub) => sub.status === 'active');

      const entries: CategoryEntry[] = [];

      base.forEach((sub) => {
        if (sub.category !== category) return;
        if (sub.billingType === 'lifetime') return;

        const stop = sub.hasStopDate ? sub.stopDate : null;

        if (activeTab === 'overall') {
          if (sub.billingType === 'monthly') {
            const months = getMonthsInYear(sub.startDate, selectedYear, stop);
            if (months > 0) {
              entries.push({ type: 'subscription', item: sub, contribution: sub.amount * months });
            }
          } else if (sub.billingType === 'yearly') {
            const startYear = typeof sub.startDate === 'string' ? new Date(sub.startDate).getFullYear() : sub.startDate.getFullYear();
            const stopYear = stop
              ? (typeof stop === 'string' ? new Date(stop).getFullYear() : stop.getFullYear())
              : undefined;
            if (startYear === selectedYear && (stopYear === undefined || stopYear >= selectedYear)) {
              entries.push({ type: 'subscription', item: sub, contribution: sub.amount });
            }
          }
        }

        if (activeTab === 'monthly') {
          if (sub.billingType !== 'monthly') return;
          if (isSubscriptionActiveInMonth(sub.startDate, selectedYear, selectedMonth, stop)) {
            entries.push({ type: 'subscription', item: sub, contribution: sub.amount });
          }
        }

        if (activeTab === 'yearly') {
          if (sub.billingType !== 'yearly') return;
          if (isSubscriptionActiveInYear(sub.startDate, selectedYear, stop)) {
            entries.push({ type: 'subscription', item: sub, contribution: sub.amount });
          }
        }
      });

      if (activeTab === 'overall') {
        oneTimeItems.forEach((item) => {
          if (item.category !== category) return;
          const year = new Date(item.date).getFullYear();
          if (year === selectedYear) {
            entries.push({ type: 'oneTime', item, contribution: item.amount });
          }
        });
      }

      return entries;
    },
    [activeTab, includeWishlist, oneTimeItems, selectedMonth, selectedYear, subscriptions],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>Dashboard</Text>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overall' && styles.tabActive]}
            onPress={() => setActiveTab('overall')}
          >
            <Text style={[styles.tabText, activeTab === 'overall' && styles.tabTextActive]}>
              Overall
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'monthly' && styles.tabActive]}
            onPress={() => setActiveTab('monthly')}
          >
            <Text style={[styles.tabText, activeTab === 'monthly' && styles.tabTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'yearly' && styles.tabActive]}
            onPress={() => setActiveTab('yearly')}
          >
            <Text style={[styles.tabText, activeTab === 'yearly' && styles.tabTextActive]}>
              Yearly
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.wishlistRow}>
          <Text style={styles.wishlistLabel}>Include Wishlist in Analytics</Text>
          <Switch value={includeWishlist} onValueChange={setIncludeWishlist} />
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#111827" style={{ marginTop: 40 }} />
        ) : (
          <>
            {!subscriptions.length ? (
              <Text style={styles.emptyText}>Add a subscription to see your spend.</Text>
            ) : null}
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>{getTabLabel()}</Text>
              {activeTab === 'overall' || activeTab === 'yearly' ? (
                <View style={styles.pickerRow}>
                  {availableYears.map((year) => (
                    <TouchableOpacity
                      key={year}
                      onPress={() => setSelectedYear(year)}
                      style={[styles.pickerItem, selectedYear === year && styles.pickerItemActive]}
                    >
                      <Text style={[styles.pickerText, selectedYear === year && styles.pickerTextActive]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {activeTab === 'monthly' ? (
                <View style={styles.pickerRow}>
                  {monthNames.map((name, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setSelectedMonth(idx)}
                      style={[styles.pickerItem, selectedMonth === idx && styles.pickerItemActive]}
                    >
                      <Text style={[styles.pickerText, selectedMonth === idx && styles.pickerTextActive]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <Text style={styles.totalAmount}>{formatCurrency(analytics.total)}</Text>

            {analytics.slices.length > 0 ? (
              <View style={styles.chartSection}>
                <DonutChart data={analytics.slices} total={analytics.total} label="Spend" />
                <View style={styles.legend}>
                  {analytics.slices.map((slice) => (
                    <Pressable
                      key={slice.category}
                      style={styles.legendRow}
                      onPress={() => setCategoryModal({ category: slice.category, entries: buildCategoryEntries(slice.category) })}
                    >
                      <View style={[styles.legendSwatch, { backgroundColor: slice.color }]} />
                      <Text style={styles.legendLabel}>{slice.category}</Text>
                      <Text style={styles.legendValue}>{formatCurrency(slice.value)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>No data for selected period</Text>
            )}

            <View style={styles.insightsSection}>
              <Text style={styles.sectionTitle}>Insights</Text>
              <Text style={styles.insightSubtitle}>Read-only counts based on current subscriptions.</Text>

              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>By category</Text>
                {insights.categoryCounts.length ? (
                  insights.categoryCounts.map((entry) => (
                    <View key={entry.label} style={styles.insightRow}>
                      <Text style={styles.insightLabel}>{entry.label}</Text>
                      <Text style={styles.insightValue}>{entry.count}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.insightEmpty}>No categories tracked yet.</Text>
                )}
              </View>

              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>By billing type</Text>
                {insights.billingCounts.map((entry) => (
                  <View key={entry.label} style={styles.insightRow}>
                    <Text style={styles.insightLabel}>{entry.label}</Text>
                    <Text style={styles.insightValue}>{entry.count}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>Credential reuse</Text>
                {insights.reusedAccounts.length ? (
                  insights.reusedAccounts.map((entry) => (
                    <View key={entry.id} style={styles.insightRow}>
                      <Text style={styles.insightLabel}>{entry.label}</Text>
                      <Text style={styles.insightValue}>{entry.count} use{entry.count === 1 ? '' : 's'}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.insightEmpty}>No linked accounts reused by multiple subscriptions.</Text>
                )}
                <Text style={styles.insightNote}>Shows accounts linked to more than one subscription.</Text>
              </View>

              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>Inactive entries</Text>
                <Text style={styles.insightNote}>Not edited in the last {insights.inactivityThreshold} months (using last start date).</Text>
                {insights.inactive.length ? (
                  insights.inactive.map((sub) => (
                    <View key={sub.id} style={styles.insightRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.insightLabel}>{sub.name}</Text>
                        <Text style={styles.insightSubtext}>{sub.billingType} • {sub.status}</Text>
                      </View>
                      <Text style={styles.insightValue}>{new Date(sub.startDate).toISOString().slice(0, 10)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.insightEmpty}>All subscriptions have recent edits.</Text>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={!!categoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCategoryModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{categoryModal?.category ?? ''}</Text>
            <Text style={styles.modalSubtitle}>Items contributing to this category</Text>
            <ScrollView style={styles.modalList}>
              {categoryModal?.entries.map(({ item, contribution, type }) => {
                const isSubscription = type === 'subscription';
                const subMeta = isSubscription
                  ? `${(item as Subscription).billingType} • ${(item as Subscription).status}`
                  : `${(item as OneTimeItem).platform} • ${formatDate((item as OneTimeItem).date)}`;
                return (
                  <View key={`${type}-${item.id}`} style={styles.modalRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemName}>{item.name}</Text>
                      <Text style={styles.modalItemMeta}>{isSubscription ? 'Subscription' : 'One-time'} • {subMeta}</Text>
                    </View>
                    <Text style={styles.modalItemValue}>{formatCurrency(contribution)}</Text>
                  </View>
                );
              })}
              {!categoryModal?.entries.length ? (
                <Text style={styles.modalEmpty}>No items found for this view.</Text>
              ) : null}
            </ScrollView>
            <Pressable style={styles.modalCloseButton} onPress={() => setCategoryModal(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 24,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#0f172a',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  wishlistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  wishlistLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  headerRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  insightsSection: {
    marginTop: 24,
    gap: 12,
  },
  insightSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  insightSubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  insightValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  insightEmpty: {
    color: '#6b7280',
    fontSize: 13,
  },
  insightNote: {
    color: '#6b7280',
    fontSize: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  pickerItemActive: {
    backgroundColor: '#0f172a',
  },
  pickerText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  pickerTextActive: {
    color: '#fff',
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 24,
  },
  chartSection: {
    gap: 20,
  },
  donutWrapper: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  chartEmptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  legend: {
    gap: 12,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendSwatch: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  legendValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 40,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  modalList: {
    maxHeight: 300,
    marginVertical: 6,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalItemMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  modalItemValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalEmpty: {
    textAlign: 'center',
    color: '#6b7280',
    paddingVertical: 20,
  },
  modalCloseButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '700',
  },
});
