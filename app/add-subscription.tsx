import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
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

import { addSubscription, Subscription } from '@/lib/db/subscriptions';

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const billingTypes: Subscription['billingType'][] = ['monthly', 'yearly', 'lifetime'];
const statuses: Subscription['status'][] = ['active', 'wishlist'];

export default function AddSubscriptionScreen() {
  const router = useRouter();
  const todayIso = useMemo(() => new Date().toISOString(), []);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Subscription['category']>('General');
  const [billingType, setBillingType] = useState<Subscription['billingType']>('monthly');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<Subscription['status']>('active');
  const [startDate] = useState<string | Date>(todayIso);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a subscription name.');
      return;
    }

    const numericAmount = parseFloat(amount);
    const needsAmount = billingType !== 'lifetime';

    if (needsAmount && (Number.isNaN(numericAmount) || numericAmount <= 0)) {
      Alert.alert('Amount required', 'Enter a valid amount greater than 0.');
      return;
    }

    const finalAmount = Number.isNaN(numericAmount) ? 0 : numericAmount;

    const payload: Subscription = {
      id: Date.now().toString(),
      name: name.trim(),
      category,
      billingType,
      amount: finalAmount,
      startDate,
      status,
      notes: notes.trim() ? notes.trim() : undefined,
    };

    setSubmitting(true);
    try {
      await addSubscription(payload);
      router.back();
    } catch (error) {
      console.warn('Failed to save subscription', error);
      Alert.alert('Save failed', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={32}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Netflix"
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
                  onPress={() => setCategory(cat as Subscription['category'])}
                  style={[styles.chip, category === cat && styles.chipSelected]}>
                  <Text style={[styles.chipText, category === cat && styles.chipTextSelected]}>{cat}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Billing</Text>
            <View style={styles.segmentRow}>
              {billingTypes.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setBillingType(type)}
                  style={[styles.segment, billingType === type && styles.segmentSelected]}>
                  <Text style={[styles.segmentText, billingType === type && styles.segmentTextSelected]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Amount {billingType === 'lifetime' ? '(optional)' : ''}</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="9.99"
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Status</Text>
            <View style={styles.segmentRow}>
              {statuses.map((stat) => (
                <Pressable
                  key={stat}
                  onPress={() => setStatus(stat)}
                  style={[styles.segment, status === stat && styles.segmentSelected]}>
                  <Text style={[styles.segmentText, status === stat && styles.segmentTextSelected]}>
                    {stat === 'active' ? 'Active' : 'Wishlist'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Start date</Text>
            <Text style={styles.staticValue}>{todayIso.slice(0, 10)}</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any quick notes"
              style={[styles.input, styles.multiline]}
              multiline
            />
          </View>

          <Pressable style={[styles.submitButton, submitting && styles.submitDisabled]} onPress={onSubmit} disabled={submitting}>
            <Text style={styles.submitText}>{submitting ? 'Saving…' : 'Save subscription'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  flex: { flex: 1 },
  container: {
    padding: 16,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  chipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  chipText: {
    color: '#111827',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#312E81',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  segmentSelected: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  segmentText: {
    fontWeight: '700',
    color: '#111827',
  },
  segmentTextSelected: {
    color: '#fff',
  },
  staticValue: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
  },
  submitButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
