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
import { colors, spacing, typography } from '@/theme';

const charcoal = '#111827';
const chartPalette = ['#6B8BC3', '#7BBFA3', '#D9C27A', '#D89A9E', '#B17BA6', '#9BA9C6', '#B0C7AA', '#C7A27B', '#C69DA6', '#A1B6CE'];

const getSliceColor = (index: number) => chartPalette[index % chartPalette.length];

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

const clampRange = (start: Date, end: Date, windowStart: Date, windowEnd: Date) => {
  const clampedStart = start > windowStart ? start : windowStart;
  const clampedEnd = end < windowEnd ? end : windowEnd;
  return { clampedStart, clampedEnd };
};

const countWeeklyOccurrencesInRange = (startDate: Date, rangeStart: Date, rangeEnd: Date): number => {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const { clampedStart, clampedEnd } = clampRange(startDate, rangeEnd, rangeStart, rangeEnd);
  if (clampedEnd < clampedStart) return 0;

  const startOffsetDays = Math.floor((clampedStart.getTime() - startDate.getTime()) / MS_PER_DAY);
  const alignedOffset = startOffsetDays % 7 === 0 ? startOffsetDays : startOffsetDays + (7 - (startOffsetDays % 7));
  const firstChargeTs = startDate.getTime() + alignedOffset * MS_PER_DAY;
  if (firstChargeTs > clampedEnd.getTime()) return 0;
  const remainingDays = Math.floor((clampedEnd.getTime() - firstChargeTs) / MS_PER_DAY);
  return 1 + Math.floor(remainingDays / 7);
};

const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

const INACTIVE_MONTHS = 6;


const DonutChart = ({ data, total, label }: { data: Slice[]; total: number; label: string }) => {
  const size = 150;
  const radius = size / 2 - 6;
  const innerRadius = 42;

  if (!data.length || total <= 0) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>No data</Text>
      </View>
    );
  }

  if (data.length === 1) {
    const slice = data[0];
    return (
      <View style={styles.donutWrapper}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={radius} fill={slice.color} />
          <Circle cx={size / 2} cy={size / 2} r={innerRadius} fill={colors.backgroundPrimary} />
          <SvgText
            x={size / 2}
            y={size / 2 + 4}
            fontSize={13}
            fontWeight="700"
            fill={colors.textSecondary}
            textAnchor="middle">
            {label}
          </SvgText>
        </Svg>
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
        <Circle cx={size / 2} cy={size / 2} r={innerRadius} fill={colors.backgroundPrimary} />
        <SvgText
          x={size / 2}
          y={size / 2 - 4}
          fontSize={12}
          fontWeight="600"
          fill={colors.textSecondary}
          textAnchor="middle">
          {label}
        </SvgText>
        <SvgText
          x={size / 2}
          y={size / 2 + 16}
          fontSize={16}
          fontWeight="800"
          fill={colors.textPrimary}
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
  const [overallYearModalVisible, setOverallYearModalVisible] = useState(false);
  const [monthlyMonthModalVisible, setMonthlyMonthModalVisible] = useState(false);
  const [yearlyYearModalVisible, setYearlyYearModalVisible] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const filteredSubscriptions = useMemo(
    () => (includeWishlist ? subscriptions : subscriptions.filter((sub) => sub.status === 'active')),
    [includeWishlist, subscriptions],
  );

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
    const oneTimeByYear = oneTimeItems.filter((item) => {
      const year = new Date(item.date).getFullYear();
      return year === selectedYear;
    });

    if (activeTab === 'overall') {
      const categoryTotals: Record<string, number> = {};
      let totalSpend = 0;

      filteredSubscriptions.forEach((sub) => {
        if (sub.billingType === 'lifetime') return;
        if (sub.userPaying === false) return;

        const stop = sub.hasStopDate ? sub.stopDate : null;

        let spend = 0;

        if (sub.billingType === 'weekly') {
          const start = typeof sub.startDate === 'string' ? new Date(sub.startDate) : sub.startDate;
          const windowStart = new Date(selectedYear, 0, 1);
          const windowEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
          const stopDate = stop ? (typeof stop === 'string' ? new Date(stop) : stop) : null;
          const effectiveEnd = stopDate && stopDate < windowEnd ? stopDate : windowEnd;
          const occurrences = countWeeklyOccurrencesInRange(start, windowStart, effectiveEnd);
          spend = sub.amount * occurrences;
        } else if (sub.billingType === 'monthly') {
          const months = getMonthsInYear(sub.startDate, selectedYear, stop);
          spend = sub.amount * months;
        } else if (sub.billingType === 'yearly') {
          if (isSubscriptionActiveInYear(sub.startDate, selectedYear, stop)) {
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

      const entries = Object.entries(categoryTotals).filter(([, value]) => value > 0);
      const slices: Slice[] = entries.map(([category, value], index) => ({
        category,
        value,
        color: getSliceColor(index),
      }));

      return { slices, total: totalSpend };
    }

    if (activeTab === 'monthly') {
      const categoryTotals: Record<string, number> = {};
      let totalSpend = 0;

      filteredSubscriptions.forEach((sub) => {
        if (sub.userPaying === false) return;

        if (sub.billingType === 'weekly') {
          const start = typeof sub.startDate === 'string' ? new Date(sub.startDate) : sub.startDate;
          const windowStart = new Date(selectedYear, selectedMonth, 1);
          const windowEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
          const stopDate = sub.hasStopDate ? (typeof sub.stopDate === 'string' ? new Date(sub.stopDate) : sub.stopDate) : null;
          const effectiveEnd = stopDate && stopDate < windowEnd ? stopDate : windowEnd;
          const occurrences = countWeeklyOccurrencesInRange(start, windowStart, effectiveEnd);
          if (occurrences > 0) {
            const key = sub.category || 'Other';
            const spend = sub.amount * occurrences;
            categoryTotals[key] = (categoryTotals[key] ?? 0) + spend;
            totalSpend += spend;
          }
          return;
        }

        if (sub.billingType !== 'monthly') return;

        if (isSubscriptionActiveInMonth(sub.startDate, selectedYear, selectedMonth, sub.hasStopDate ? sub.stopDate : null)) {
          const key = sub.category || 'Other';
          categoryTotals[key] = (categoryTotals[key] ?? 0) + sub.amount;
          totalSpend += sub.amount;
        }
      });

      const entries = Object.entries(categoryTotals).filter(([, value]) => value > 0);
      const slices: Slice[] = entries.map(([category, value], index) => ({
        category,
        value,
        color: getSliceColor(index),
      }));

      return { slices, total: totalSpend };
    }

    if (activeTab === 'yearly') {
      const categoryTotals: Record<string, number> = {};
      let totalSpend = 0;

      filteredSubscriptions.forEach((sub) => {
        if (sub.userPaying === false) return;
        if (sub.billingType !== 'yearly') return;

        if (isSubscriptionActiveInYear(sub.startDate, selectedYear, sub.hasStopDate ? sub.stopDate : null)) {
          const key = sub.category || 'Other';
          categoryTotals[key] = (categoryTotals[key] ?? 0) + sub.amount;
          totalSpend += sub.amount;
        }
      });

      const entries = Object.entries(categoryTotals).filter(([, value]) => value > 0);
      const slices: Slice[] = entries.map(([category, value], index) => ({
        category,
        value,
        color: getSliceColor(index),
      }));

      return { slices, total: totalSpend };
    }

    return { slices: [], total: 0 };
  }, [activeTab, filteredSubscriptions, oneTimeItems, selectedMonth, selectedYear]);

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
    const billingCount: Record<Subscription['billingType'], number> = {
      weekly: 0,
      monthly: 0,
      yearly: 0,
      lifetime: 0,
    };
    const credentialUsage: Record<string, number> = {};
    const inactive: Subscription[] = [];

    filteredSubscriptions.forEach((sub) => {
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
  }, [credentialMap, filteredSubscriptions]);

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

  useEffect(() => {
    setOverallYearModalVisible(false);
    setMonthlyMonthModalVisible(false);
    setYearlyYearModalVisible(false);
  }, [activeTab]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getTabLabel = () => {
    if (activeTab === 'overall') return 'Overall Spend';
    if (activeTab === 'monthly') return 'Monthly Spend';
    if (activeTab === 'yearly') return 'Yearly Spend';
    return '';
  };

  const getTabSubtitle = () => {
    if (activeTab === 'overall') {
      return 'Total expected spend for the selected year, multiplying monthly charges by active months (start/stop aware), counting weekly occurrences, and allocating each yearly renewal to every active year.';
    }
    if (activeTab === 'monthly') {
      return 'Month-specific spend including weekly charges that fall inside the month and monthly subscriptions active during that window.';
    }
    if (activeTab === 'yearly') {
      return 'Annual renewals that occur in the selected year for subscriptions still active that year—one annual charge per active year.';
    }
    return '';
  };

  const buildCategoryEntries = useCallback(
    (category: string) => {
      const entries: CategoryEntry[] = [];

      filteredSubscriptions.forEach((sub) => {
        if (sub.category !== category) return;
        if (sub.billingType === 'lifetime') return;
        if (sub.userPaying === false) return;

        const stop = sub.hasStopDate ? sub.stopDate : null;

        if (activeTab === 'overall') {
          if (sub.billingType === 'weekly') {
            const start = typeof sub.startDate === 'string' ? new Date(sub.startDate) : sub.startDate;
            const windowStart = new Date(selectedYear, 0, 1);
            const windowEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
            const stopDate = stop ? (typeof stop === 'string' ? new Date(stop) : stop) : null;
            const effectiveEnd = stopDate && stopDate < windowEnd ? stopDate : windowEnd;
            const occurrences = countWeeklyOccurrencesInRange(start, windowStart, effectiveEnd);
            if (occurrences > 0) {
              entries.push({ type: 'subscription', item: sub, contribution: sub.amount * occurrences });
            }
          } else if (sub.billingType === 'monthly') {
            const months = getMonthsInYear(sub.startDate, selectedYear, stop);
            if (months > 0) {
              entries.push({ type: 'subscription', item: sub, contribution: sub.amount * months });
            }
          } else if (sub.billingType === 'yearly') {
            if (isSubscriptionActiveInYear(sub.startDate, selectedYear, stop)) {
              entries.push({ type: 'subscription', item: sub, contribution: sub.amount });
            }
          }
        }

        if (activeTab === 'monthly') {
          if (sub.billingType === 'weekly') {
            const start = typeof sub.startDate === 'string' ? new Date(sub.startDate) : sub.startDate;
            const windowStart = new Date(selectedYear, selectedMonth, 1);
            const windowEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
            const stopDate = stop ? (typeof stop === 'string' ? new Date(stop) : stop) : null;
            const effectiveEnd = stopDate && stopDate < windowEnd ? stopDate : windowEnd;
            const occurrences = countWeeklyOccurrencesInRange(start, windowStart, effectiveEnd);
            if (occurrences > 0) {
              entries.push({ type: 'subscription', item: sub, contribution: sub.amount * occurrences });
            }
            return;
          }

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
    [activeTab, filteredSubscriptions, oneTimeItems, selectedMonth, selectedYear],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>DASHBOARD</Text>

        <View style={styles.tabRow}>
          {(['overall', 'monthly', 'yearly'] as SpendTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'overall' ? 'Overall' : tab === 'monthly' ? 'Monthly' : 'Yearly'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.tabSubtitle}>{getTabSubtitle()}</Text>

        <View style={styles.wishlistRow}>
          <Text style={styles.wishlistLabel}>Include wishlist in analytics</Text>
          <Switch
            value={includeWishlist}
            onValueChange={setIncludeWishlist}
            trackColor={{ false: colors.borderSubtle, true: charcoal }}
            thumbColor={colors.backgroundPrimary}
            ios_backgroundColor={colors.borderSubtle}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={colors.textPrimary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {!subscriptions.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No subscriptions yet</Text>
                <Text style={styles.emptySubtext}>Add a subscription to see your spend breakdown.</Text>
              </View>
            ) : null}
            <View style={styles.headerRow}>
              <Text style={styles.sectionTitle}>{getTabLabel()}</Text>
              <View style={styles.selectorRow}>
                {activeTab === 'overall' ? (
                  <Pressable style={styles.selectorField} onPress={() => setOverallYearModalVisible(true)}>
                    <Text style={styles.selectorValue}>{selectedYear}</Text>
                  </Pressable>
                ) : null}
                {activeTab === 'monthly' ? (
                  <Pressable style={styles.selectorField} onPress={() => setMonthlyMonthModalVisible(true)}>
                    <Text style={styles.selectorValue}>{monthNames[selectedMonth]} {selectedYear}</Text>
                  </Pressable>
                ) : null}
                {activeTab === 'yearly' ? (
                  <Pressable style={styles.selectorField} onPress={() => setYearlyYearModalVisible(true)}>
                    <Text style={styles.selectorValue}>{selectedYear}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Text style={styles.totalAmount}>{formatCurrency(analytics.total)}</Text>

            {analytics.slices.length > 0 ? (
              <View style={styles.chartSection}>
                <View style={styles.chartColumn}>
                  <DonutChart data={analytics.slices} total={analytics.total} label="Spend" />
                </View>
                <View style={styles.legend}>
                  {analytics.slices.map((slice) => {
                    const share = analytics.total ? (slice.value / analytics.total) * 100 : 0;
                    return (
                      <Pressable
                        key={slice.category}
                        style={styles.legendRow}
                        onPress={() => setCategoryModal({ category: slice.category, entries: buildCategoryEntries(slice.category) })}
                      >
                        <View style={[styles.legendSwatch, { backgroundColor: slice.color }]} />
                        <View style={styles.legendTextBlock}>
                          <Text style={styles.legendLabel}>{slice.category}</Text>
                          <Text style={styles.legendMeta}>{`${formatCurrency(slice.value)} · ${share.toFixed(1)}% of spend`}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : (
              <View style={[styles.chartSection, styles.chartPlaceholderCard]}>
                <Text style={styles.emptyText}>No data for the selected period yet.</Text>
              </View>
            )}

            <View style={styles.insightsSection}>
              <Text style={styles.sectionTitle}>Insights</Text>
              <Text style={styles.insightSubtitle}>Read-only counts based on current subscriptions.</Text>

              <View style={styles.insightGrid}>
                <View style={styles.insightTile}>
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

                <View style={styles.insightTile}>
                  <Text style={styles.insightTitle}>By billing type</Text>
                  {insights.billingCounts.map((entry) => (
                    <View key={entry.label} style={styles.insightRow}>
                      <Text style={styles.insightLabel}>{entry.label}</Text>
                      <Text style={styles.insightValue}>{entry.count}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.insightTile}>
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

                <View style={styles.insightTile}>
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
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={overallYearModalVisible && activeTab === 'overall'}
        transparent
        animationType="none"
        onRequestClose={() => setOverallYearModalVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setOverallYearModalVisible(false)}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Select Year</Text>
            <View style={styles.modalOptionsList}>
              {availableYears.map((year) => (
                <Pressable
                  key={year}
                  style={[styles.modalOption, selectedYear === year && styles.modalOptionActive]}
                  onPress={() => {
                    setSelectedYear(year);
                    setOverallYearModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, selectedYear === year && styles.modalOptionTextActive]}>{year}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={monthlyMonthModalVisible && activeTab === 'monthly'}
        transparent
        animationType="none"
        onRequestClose={() => setMonthlyMonthModalVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setMonthlyMonthModalVisible(false)}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Select Month</Text>
            <View style={styles.modalOptionsList}>
              {monthNames.map((name, idx) => (
                <Pressable
                  key={name}
                  style={[styles.modalOption, selectedMonth === idx && styles.modalOptionActive]}
                  onPress={() => {
                    setSelectedMonth(idx);
                    setMonthlyMonthModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, selectedMonth === idx && styles.modalOptionTextActive]}>{name}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={yearlyYearModalVisible && activeTab === 'yearly'}
        transparent
        animationType="none"
        onRequestClose={() => setYearlyYearModalVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setYearlyYearModalVisible(false)}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Select Year</Text>
            <View style={styles.modalOptionsList}>
              {availableYears.map((year) => (
                <Pressable
                  key={year}
                  style={[styles.modalOption, selectedYear === year && styles.modalOptionActive]}
                  onPress={() => {
                    setSelectedYear(year);
                    setYearlyYearModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, selectedYear === year && styles.modalOptionTextActive]}>{year}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!categoryModal}
        transparent
        animationType="none"
        onRequestClose={() => setCategoryModal(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setCategoryModal(null)}>
          <Pressable style={styles.bottomSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
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
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  container: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl + spacing.sm,
  },
  title: {
    ...typography.pageTitle,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: '#F4F6FA',
    borderRadius: spacing.lg,
    padding: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#E3E8F2',
    borderColor: '#C3CDDE',
  },
  tabText: {
    ...typography.body,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  tabSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  wishlistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
    backgroundColor: colors.backgroundPrimary,
    marginBottom: spacing.xl,
  },
  wishlistLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    flexWrap: 'wrap',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    fontSize: 22,
    fontWeight: '600',
    fontStyle: 'italic',
    color: colors.textPrimary,
  },
  insightsSection: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  insightSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  insightTile: {
    flexBasis: '48%',
    backgroundColor: colors.backgroundPrimary,
    borderRadius: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.xs,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  insightLabel: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  insightSubtext: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  insightValue: {
    ...typography.body,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  insightEmpty: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  insightNote: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  pickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pickerItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.borderSubtle,
  },
  pickerItemActive: {
    backgroundColor: colors.textPrimary,
  },
  pickerText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textMuted,
  },
  pickerTextActive: {
    color: colors.backgroundPrimary,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  chartSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  chartColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  donutWrapper: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl + spacing.sm,
  },
  chartEmptyText: {
    color: colors.textMuted,
    ...typography.body,
  },
  chartPlaceholderCard: {
    backgroundColor: colors.backgroundPrimary,
    padding: spacing.lg,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    width: '100%',
  },
  legend: {
    flex: 1,
    minWidth: 200,
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  legendTextBlock: {
    flex: 1,
    gap: 2,
  },
  legendSwatch: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: spacing.lg,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  legendLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  legendMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxl + spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.backgroundPrimary,
    borderRadius: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textMuted,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'flex-end',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  selectorField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.backgroundPrimary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minWidth: 120,
  },
  selectorLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  selectorValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalCard: {
    width: '100%',
    borderRadius: spacing.md,
    backgroundColor: colors.backgroundPrimary,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.sectionTitle,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modalList: {
    maxHeight: 300,
    marginVertical: spacing.sm,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  modalItemName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalItemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  modalItemValue: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalEmpty: {
    textAlign: 'center',
    color: colors.textMuted,
    paddingVertical: spacing.xl,
  },
  modalCloseButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
  },
  modalCloseText: {
    color: colors.backgroundPrimary,
    fontWeight: '700',
  },
  bottomSheet: {
    width: '100%',
    borderTopLeftRadius: spacing.xl,
    borderTopRightRadius: spacing.xl,
    backgroundColor: colors.backgroundPrimary,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.borderSubtle,
  },
  modalOptionsList: {
    gap: spacing.xs,
  },
  modalOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalOptionActive: {
    backgroundColor: '#EEF2F7',
    borderColor: '#CBD5E1',
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalOptionTextActive: {
    color: colors.textPrimary,
  },
});
