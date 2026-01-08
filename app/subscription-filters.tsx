import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { Credential, getAllCredentials } from '@/lib/db/credentials';
import { Subscription } from '@/lib/db/subscriptions';
import { colors, spacing } from '@/theme';

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
    const initialFilters: Filters = params.filters ? JSON.parse(params.filters) : defaultFilters;
    const [filters, setFilters] = useState<Filters>(initialFilters);
    const [visible, setVisible] = useState(true);

    const loadCredentials = useCallback(async () => {
        const list = await getAllCredentials();
        setCredentials(list);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadCredentials();
        }, [loadCredentials]),
    );

    const closeSheet = useCallback(() => {
        setVisible(false);
        router.back();
    }, [router]);

    const handleApply = async () => {
        await AsyncStorage.setItem(SUBSCRIPTION_FILTERS_KEY, JSON.stringify(filters));
        closeSheet();
    };

    const handleClear = () => {
        setFilters(defaultFilters);
    };

    const toggleCategory = (cat: string) => {
        setFilters((prev) => ({
            ...prev,
            categories: prev.categories.includes(cat)
                ? prev.categories.filter((c) => c !== cat)
                : [...prev.categories, cat],
        }));
    };

    const renderOption = (label: string, active: boolean, onPress: () => void) => (
        <Pressable key={label} onPress={onPress} style={styles.optionRow}>
            <View style={styles.optionIndicator}>{active ? <View style={styles.optionDot} /> : null}</View>
            <Text variant="body" color={colors.textPrimary}>
                {label}
            </Text>
        </Pressable>
    );

    return (
        <BottomSheet visible={visible} onClose={closeSheet} title="Adjust filters">
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text variant="caption" color={colors.textSecondary} style={styles.sectionLabel}>
                        Categories
                    </Text>
                    {renderOption('All categories', filters.categories.length === 0, () =>
                        setFilters((prev) => ({ ...prev, categories: [] })),
                    )}
                    {categories.map((cat) =>
                        renderOption(cat, filters.categories.includes(cat), () => toggleCategory(cat)),
                    )}
                </View>

                <View style={styles.section}>
                    <Text variant="caption" color={colors.textSecondary} style={styles.sectionLabel}>
                        Billing
                    </Text>
                    {renderOption('All billing', filters.billingType === 'all', () =>
                        setFilters((prev) => ({ ...prev, billingType: 'all' })),
                    )}
                    {billingTypes.map((type) =>
                        renderOption(type, filters.billingType === type, () =>
                            setFilters((prev) => ({ ...prev, billingType: type })),
                        ),
                    )}
                </View>

                <View style={styles.section}>
                    <Text variant="caption" color={colors.textSecondary} style={styles.sectionLabel}>
                        Status
                    </Text>
                    {renderOption('All statuses', filters.status === 'all', () =>
                        setFilters((prev) => ({ ...prev, status: 'all' })),
                    )}
                    {statuses.map((value) =>
                        renderOption(value === 'active' ? 'Active' : 'Wishlist', filters.status === value, () =>
                            setFilters((prev) => ({ ...prev, status: value })),
                        ),
                    )}
                </View>

                <View style={styles.section}>
                    <Text variant="caption" color={colors.textSecondary} style={styles.sectionLabel}>
                        Access type
                    </Text>
                    {renderOption('All access', filters.accessType === 'all', () =>
                        setFilters((prev) => ({ ...prev, accessType: 'all' })),
                    )}
                    {renderOption('Owned', filters.accessType === 'owned', () =>
                        setFilters((prev) => ({ ...prev, accessType: 'owned' })),
                    )}
                    {renderOption('Shared', filters.accessType === 'shared', () =>
                        setFilters((prev) => ({ ...prev, accessType: 'shared' })),
                    )}
                </View>

                <View style={styles.section}>
                    <Text variant="caption" color={colors.textSecondary} style={styles.sectionLabel}>
                        Linked account
                    </Text>
                    {renderOption('All accounts', filters.credential === 'all', () =>
                        setFilters((prev) => ({ ...prev, credential: 'all' })),
                    )}
                    {renderOption('None linked', filters.credential === 'none', () =>
                        setFilters((prev) => ({ ...prev, credential: 'none' })),
                    )}
                    {credentials.map((cred) =>
                        renderOption(cred.label, filters.credential === cred.id, () =>
                            setFilters((prev) => ({ ...prev, credential: cred.id })),
                        ),
                    )}
                </View>
            </ScrollView>

            <View style={styles.actions}>
                <SecondaryButton label="Clear" onPress={handleClear} style={styles.actionButton} />
                <PrimaryButton label="Apply" onPress={handleApply} style={styles.actionButton} />
            </View>
        </BottomSheet>
    );
}

const styles = StyleSheet.create({
    content: {
        gap: spacing.xl,
        paddingBottom: spacing.xl,
    },
    section: {
        gap: spacing.sm,
    },
    sectionLabel: {
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.xs,
    },
    optionIndicator: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.accentPrimary,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingTop: spacing.md,
    },
    actionButton: {
        flex: 1,
    },
});
