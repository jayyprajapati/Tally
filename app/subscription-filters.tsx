import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Credential, getAllCredentials } from '@/lib/db/credentials';
import { Subscription } from '@/lib/db/subscriptions';
import { colors, spacing, typography } from '@/theme';

export const SUBSCRIPTION_FILTERS_KEY = 'subscription_filters';

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const billingTypes: Subscription['billingType'][] = ['weekly', 'monthly', 'yearly', 'lifetime'];
const statuses: Subscription['status'][] = ['active', 'wishlist'];

type Filters = {
    categories: string[];
    billingType: string;
    status: string;
    credential: string;
    accessType: 'all' | Subscription['accessType'];
};

const defaultFilters: Filters = {
    categories: [],
    billingType: 'all',
    status: 'active',
    credential: 'all',
    accessType: 'all',
};

export default function SubscriptionFiltersScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ filters?: string }>();
    const [credentials, setCredentials] = useState<Credential[]>([]);

    // Parse initial filters from params
    const initialFilters: Filters = params.filters
        ? JSON.parse(params.filters)
        : defaultFilters;

    const [filters, setFilters] = useState<Filters>(initialFilters);

    const loadCredentials = useCallback(async () => {
        const list = await getAllCredentials();
        setCredentials(list);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadCredentials();
        }, [loadCredentials]),
    );

    const handleApply = async () => {
        await AsyncStorage.setItem(SUBSCRIPTION_FILTERS_KEY, JSON.stringify(filters));
        router.back();
    };

    const handleClear = async () => {
        setFilters(defaultFilters);
    };

    const handleCancel = () => {
        router.back();
    };

    const toggleCategory = (cat: string) => {
        setFilters((prev) => ({
            ...prev,
            categories: prev.categories.includes(cat)
                ? prev.categories.filter((c) => c !== cat)
                : [...prev.categories, cat],
        }));
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Category</Text>
                    <View style={styles.chipRowWrap}>
                        <Pressable
                            style={[styles.filterChip, filters.categories.length === 0 && styles.filterChipActive]}
                            onPress={() => setFilters((prev) => ({ ...prev, categories: [] }))}>
                            <Text style={[styles.filterChipText, filters.categories.length === 0 && styles.filterChipTextActive]}>
                                All
                            </Text>
                        </Pressable>
                        {categories.map((cat) => (
                            <Pressable
                                key={cat}
                                style={[styles.filterChip, filters.categories.includes(cat) && styles.filterChipActive]}
                                onPress={() => toggleCategory(cat)}>
                                <Text style={[styles.filterChipText, filters.categories.includes(cat) && styles.filterChipTextActive]}>
                                    {cat}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Billing type</Text>
                    <View style={styles.chipRowWrap}>
                        <Pressable
                            style={[styles.filterChip, filters.billingType === 'all' && styles.filterChipActive]}
                            onPress={() => setFilters((prev) => ({ ...prev, billingType: 'all' }))}>
                            <Text style={[styles.filterChipText, filters.billingType === 'all' && styles.filterChipTextActive]}>
                                All
                            </Text>
                        </Pressable>
                        {billingTypes.map((type) => (
                            <Pressable
                                key={type}
                                style={[styles.filterChip, filters.billingType === type && styles.filterChipActive]}
                                onPress={() => setFilters((prev) => ({ ...prev, billingType: type }))}>
                                <Text style={[styles.filterChipText, filters.billingType === type && styles.filterChipTextActive]}>
                                    {type}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Status</Text>
                    <View style={styles.chipRowWrap}>
                        <Pressable
                            style={[styles.filterChip, filters.status === 'all' && styles.filterChipActive]}
                            onPress={() => setFilters((prev) => ({ ...prev, status: 'all' }))}>
                            <Text style={[styles.filterChipText, filters.status === 'all' && styles.filterChipTextActive]}>All</Text>
                        </Pressable>
                        {statuses.map((stat) => (
                            <Pressable
                                key={stat}
                                style={[styles.filterChip, filters.status === stat && styles.filterChipActive]}
                                onPress={() => setFilters((prev) => ({ ...prev, status: stat }))}>
                                <Text style={[styles.filterChipText, filters.status === stat && styles.filterChipTextActive]}>
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
                            style={[styles.filterChip, filters.accessType === 'all' && styles.filterChipActive]}
                            onPress={() => setFilters((prev) => ({ ...prev, accessType: 'all' }))}>
                            <Text style={[styles.filterChipText, filters.accessType === 'all' && styles.filterChipTextActive]}>
                                All
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.filterChip, filters.accessType === 'owned' && styles.filterChipActive]}
                            onPress={() => setFilters((prev) => ({ ...prev, accessType: 'owned' }))}>
                            <Text style={[styles.filterChipText, filters.accessType === 'owned' && styles.filterChipTextActive]}>
                                Owned
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.filterChip, filters.accessType === 'shared' && styles.filterChipActive]}
                            onPress={() => setFilters((prev) => ({ ...prev, accessType: 'shared' }))}>
                            <Text style={[styles.filterChipText, filters.accessType === 'shared' && styles.filterChipTextActive]}>
                                Shared
                            </Text>
                        </Pressable>
                    </View>
                </View>

                <View style={styles.filterGroup}>
                    <Text style={styles.filterLabel}>Linked account</Text>
                    <View style={styles.chipRowWrap}>
                        <Pressable
                            style={[styles.filterChip, filters.credential === 'all' && styles.filterChipActive]}
                            onPress={() => setFilters((prev) => ({ ...prev, credential: 'all' }))}>
                            <Text style={[styles.filterChipText, filters.credential === 'all' && styles.filterChipTextActive]}>
                                All
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[styles.filterChip, filters.credential === 'none' && styles.filterChipActive]}
                            onPress={() => setFilters((prev) => ({ ...prev, credential: 'none' }))}>
                            <Text style={[styles.filterChipText, filters.credential === 'none' && styles.filterChipTextActive]}>
                                None
                            </Text>
                        </Pressable>
                        {credentials.map((cred) => (
                            <Pressable
                                key={cred.id}
                                style={[styles.filterChip, filters.credential === cred.id && styles.filterChipActive]}
                                onPress={() => setFilters((prev) => ({ ...prev, credential: cred.id }))}>
                                <Text
                                    style={[styles.filterChipText, filters.credential === cred.id && styles.filterChipTextActive]}
                                    numberOfLines={1}>
                                    {cred.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.actions}>
                <Pressable style={[styles.button, styles.clearButton]} onPress={handleClear}>
                    <Text style={styles.clearText}>Clear Filters</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.applyButton]} onPress={handleApply}>
                    <Text style={styles.applyText}>Apply Filters</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
    },
    container: {
        padding: spacing.lg,
        gap: spacing.xl,
    },
    filterGroup: {
        gap: spacing.sm,
    },
    filterLabel: {
        ...typography.body,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    chipRowWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    filterChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 999,
        backgroundColor: colors.backgroundPrimary,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    filterChipActive: {
        backgroundColor: colors.textPrimary,
        borderColor: colors.textPrimary,
    },
    filterChipText: {
        ...typography.caption,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    filterChipTextActive: {
        color: colors.backgroundPrimary,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.lg,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
        backgroundColor: colors.backgroundSecondary,
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: spacing.md,
        alignItems: 'center',
    },
    clearButton: {
        backgroundColor: colors.backgroundPrimary,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    clearText: {
        fontWeight: '700',
        fontSize: 16,
        color: colors.textPrimary,
    },
    applyButton: {
        backgroundColor: colors.textPrimary,
    },
    applyText: {
        fontWeight: '700',
        fontSize: 16,
        color: colors.backgroundPrimary,
    },
});
