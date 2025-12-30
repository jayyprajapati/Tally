import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';

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

const MONTHS_IN_YEAR = 12;

const normalizeMonthlyAmount = (subscription: Subscription): number => {
  if (subscription.billingType === 'yearly') {
    return subscription.amount / MONTHS_IN_YEAR;
  }
  if (subscription.billingType === 'monthly') {
    return subscription.amount;
  }
  return 0;
};

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});

const DonutChart = ({ data, total }: { data: Slice[]; total: number }) => {
  const size = 220;
  const radius = size / 2 - 6;
  const innerRadius = 70;

  if (!data.length || total <= 0) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>No recurring spend yet</Text>
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
        <Circle cx={size / 2} cy={size / 2} r={innerRadius} fill="#f8f8f8" stroke="#e5e7eb" />
        <SvgText
          x={size / 2}
          y={size / 2 - 4}
          fontSize={14}
          fontWeight="600"
          fill="#6b7280"
          textAnchor="middle">
          Monthly
        </SvgText>
        <SvgText
          x={size / 2}
          y={size / 2 + 16}
          fontSize={18}
          fontWeight="800"
          fill="#0f172a"
          textAnchor="middle">
          {formatCurrency(total)}
        </SvgText>
      </Svg>
    </View>
  );
};

const SpendComparisonChart = ({ active, wishlist }: { active: number; wishlist: number }) => {
  const rows = [
    { label: 'Active', value: active, color: '#111827' },
    { label: 'Wishlist', value: wishlist, color: '#475569' },
  ];
  const barWidth = 240;
  const maxValue = Math.max(active, wishlist, 1);

  return (
    <Svg width={barWidth + 120} height={rows.length * 36}>
      {rows.map((row, index) => {
        const width = (row.value / maxValue) * barWidth;
        const y = index * 36 + 10;
        return (
          <G key={row.label}>
            <SvgText x={0} y={y + 14} fontSize={12} fontWeight="700" fill="#0f172a">
              {row.label}
            </SvgText>
            <Rect x={70} y={y} width={barWidth} height={18} rx={9} fill="#e5e7eb" />
            <Rect x={70} y={y} width={width} height={18} rx={9} fill={row.color} />
            <SvgText x={70 + barWidth + 10} y={y + 14} fontSize={12} fontWeight="600" fill="#0f172a">
              {formatCurrency(row.value)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
};

export default function DashboardScreen() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeWishlist, setIncludeWishlist] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllSubscriptions();
      setSubscriptions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
    }, [loadSubscriptions]),
  );

  const analytics = useMemo(() => {
    const base = includeWishlist
      ? subscriptions
      : subscriptions.filter((sub) => sub.status === 'active');

    const recurring = base.filter((sub) => sub.billingType !== 'lifetime');

    const categoryTotals: Record<string, number> = {};
    recurring.forEach((sub) => {
      const amount = normalizeMonthlyAmount(sub);
      const key = sub.category || 'Other';
      categoryTotals[key] = (categoryTotals[key] ?? 0) + amount;
    });

    const slices: Slice[] = Object.entries(categoryTotals)
      .filter(([, value]) => value > 0)
      .map(([category, value]) => ({
        category,
        value,
        color: categoryMeta[category as CategoryKey]?.color ?? categoryMeta.Other.color,
      }));

    const activeSpend = recurring
      .filter((sub) => sub.status === 'active')
      .reduce((sum, sub) => sum + normalizeMonthlyAmount(sub), 0);

    const wishlistSpend = recurring
      .filter((sub) => sub.status === 'wishlist')
      .reduce((sum, sub) => sum + normalizeMonthlyAmount(sub), 0);

    const lifetimeCount = base.filter((sub) => sub.billingType === 'lifetime').length;

    const totalRecurring = recurring.reduce((sum, sub) => sum + normalizeMonthlyAmount(sub), 0);

    return {
      slices,
      activeSpend,
      wishlistSpend,
      lifetimeCount,
      totalRecurring,
    };
  }, [includeWishlist, subscriptions]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Normalized monthly view of your subscriptions</Text>
          </View>
          <View style={styles.toggleCard}>
            <Text style={styles.toggleLabel}>Include Wishlist in Analytics</Text>
            <Switch value={includeWishlist} onValueChange={setIncludeWishlist} />
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#111827" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Monthly recurring</Text>
                <Text style={styles.statValue}>{formatCurrency(analytics.totalRecurring)}</Text>
                <Text style={styles.statNote}>Lifetime is excluded from spend</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>Lifetime subscriptions</Text>
                <Text style={styles.statValue}>{analytics.lifetimeCount}</Text>
                <Text style={styles.statNote}>Count respects the wishlist toggle</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Category monthly spend</Text>
                <Text style={styles.cardSubTitle}>Monthly and yearly normalized, lifetime excluded</Text>
              </View>
              <View style={styles.chartRow}>
                <DonutChart data={analytics.slices} total={analytics.totalRecurring} />
                <View style={styles.legend}>
                  {analytics.slices.map((slice) => (
                    <View key={slice.category} style={styles.legendRow}>
                      <View style={[styles.legendSwatch, { backgroundColor: slice.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.legendLabel}>{slice.category}</Text>
                        <Text style={styles.legendValue}>{formatCurrency(slice.value)}</Text>
                      </View>
                    </View>
                  ))}
                  {!analytics.slices.length ? (
                    <Text style={styles.chartEmptyText}>No categories to display</Text>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Active vs wishlist spend</Text>
                <Text style={styles.cardSubTitle}>Recurring only, monthly normalized</Text>
              </View>
              <View style={styles.comparisonWrapper}>
                <SpendComparisonChart
                  active={analytics.activeSpend}
                  wishlist={includeWishlist ? analytics.wishlistSpend : 0}
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  container: {
    padding: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  toggleCard: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'flex-end',
    gap: 6,
  },
  toggleLabel: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  statLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '700',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  statNote: {
    fontSize: 12,
    color: '#64748b',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSubTitle: {
    fontSize: 12,
    color: '#475569',
  },
  chartRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  donutWrapper: {
    paddingVertical: 8,
  },
  legend: {
    flex: 1,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  legendValue: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  chartEmptyText: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
  },
  comparisonWrapper: {
    alignItems: 'center',
    paddingVertical: 6,
  },
});
