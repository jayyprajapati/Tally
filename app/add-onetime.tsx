import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addOneTimeItem, OneTimeItem } from '@/lib/db/onetime-items';
import { colors, spacing, typography } from '@/theme';

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export default function AddOneTimeScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ item?: string }>();
    const [name, setName] = useState('');
    const [platform, setPlatform] = useState('');
    const [category, setCategory] = useState<string>('General');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingId, setEditingId] = useState<string | number | null>(null);

    useEffect(() => {
        const raw = Array.isArray(params.item) ? params.item[0] : params.item;
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw) as OneTimeItem;
            setEditingId(parsed.id);
            setName(parsed.name);
            setPlatform(parsed.platform);
            setCategory(parsed.category);
            setAmount(String(parsed.amount));
            setDate(new Date(parsed.date));
        } catch {
            // ignore invalid payloads
        }
    }, [params.item]);

    const handleSave = async () => {
        if (submitting) return;

        if (!name.trim()) {
            Alert.alert('Name required', 'Please enter a name.');
            return;
        }
        if (!platform.trim()) {
            Alert.alert('Platform required', 'Please enter the platform.');
            return;
        }

        const parsedAmount = parseFloat(amount);
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            Alert.alert('Amount required', 'Enter an amount greater than 0.');
            return;
        }

        const payload: OneTimeItem = {
            id: editingId ? String(editingId) : Date.now().toString(),
            name: name.trim(),
            platform: platform.trim(),
            category,
            amount: parsedAmount,
            date: date.toISOString(),
        };

        setSubmitting(true);
        try {
            await addOneTimeItem(payload);
            router.back();
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        router.back();
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
                keyboardVerticalOffset={32}>
                <ScrollView contentContainerStyle={styles.container}>
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Movie ticket"
                            placeholderTextColor={colors.textMuted}
                            style={styles.input}
                            autoCapitalize="words"
                            returnKeyType="next"
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Platform</Text>
                        <TextInput
                            value={platform}
                            onChangeText={setPlatform}
                            placeholder="e.g. Apple TV"
                            placeholderTextColor={colors.textMuted}
                            style={styles.input}
                            autoCapitalize="words"
                            returnKeyType="next"
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Category</Text>
                        <View style={styles.chipRow}>
                            {categories.map((cat) => (
                                <Pressable
                                    key={cat}
                                    onPress={() => setCategory(cat)}
                                    style={[styles.chip, category === cat && styles.chipSelected]}>
                                    <Text style={[styles.chipText, category === cat && styles.chipTextSelected]}>{cat}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Amount</Text>
                        <TextInput
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="0.00"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="decimal-pad"
                            style={styles.input}
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Date</Text>
                        <Pressable style={styles.staticValue} onPress={() => setShowDatePicker(true)}>
                            <Text style={styles.dateText}>{formatDate(date)}</Text>
                        </Pressable>
                        {showDatePicker ? (
                            <DateTimePicker
                                value={date}
                                mode="date"
                                display="spinner"
                                onChange={(event, selectedDate) => {
                                    if (event.type === 'dismissed') {
                                        setShowDatePicker(false);
                                        return;
                                    }
                                    if (selectedDate) setDate(selectedDate);
                                    setShowDatePicker(false);
                                }}
                            />
                        ) : null}
                    </View>

                    <View style={styles.actions}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.button, styles.saveButton, submitting && styles.saveDisabled]}
                            onPress={handleSave}
                            disabled={submitting}>
                            <Text style={styles.saveText}>{submitting ? 'Saving…' : editingId ? 'Update' : 'Save'}</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
    },
    flex: { flex: 1 },
    container: {
        padding: spacing.lg,
        gap: spacing.lg,
    },
    fieldGroup: {
        gap: spacing.sm,
    },
    label: {
        ...typography.body,
        fontWeight: '700',
        color: colors.textPrimary,
    },
    input: {
        backgroundColor: colors.backgroundPrimary,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: 16,
        color: colors.textPrimary,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    chip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.backgroundPrimary,
    },
    chipSelected: {
        backgroundColor: colors.accentPrimary,
        borderColor: colors.accentPrimary,
    },
    chipText: {
        color: colors.textPrimary,
        fontWeight: '600',
    },
    chipTextSelected: {
        color: colors.backgroundPrimary,
    },
    staticValue: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.backgroundPrimary,
    },
    dateText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    button: {
        flex: 1,
        paddingVertical: spacing.md,
        borderRadius: spacing.md,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: colors.backgroundPrimary,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
    },
    cancelText: {
        fontWeight: '700',
        fontSize: 16,
        color: colors.textPrimary,
    },
    saveButton: {
        backgroundColor: colors.textPrimary,
    },
    saveDisabled: {
        opacity: 0.7,
    },
    saveText: {
        fontWeight: '700',
        fontSize: 16,
        color: colors.backgroundPrimary,
    },
});
