import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Credential, getAllCredentials, maskCredentialValue } from '@/lib/db/credentials';
import { Subscription, getSubscriptionById, updateSubscription } from '@/lib/db/subscriptions';

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const billingTypes: Subscription['billingType'][] = ['monthly', 'yearly', 'lifetime'];
const statuses: Subscription['status'][] = ['active', 'wishlist'];

export default function EditSubscriptionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Subscription['category']>('General');
  const [billingType, setBillingType] = useState<Subscription['billingType']>('monthly');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<Subscription['status']>('active');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [linkedCredentialId, setLinkedCredentialId] = useState<string | undefined>(undefined);
  const [pickerVisible, setPickerVisible] = useState(false);

  const loadCredentials = useCallback(async () => {
    const list = await getAllCredentials();
    setCredentials(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCredentials();
    }, [loadCredentials]),
  );

  const hydrateForm = useCallback(async () => {
    if (!id) {
      router.back();
      return;
    }
    const existing = await getSubscriptionById(id);
    if (!existing) {
      Alert.alert('Not found', 'Subscription could not be loaded.');
      router.back();
      return;
    }

    setName(existing.name);
    setCategory(existing.category as Subscription['category']);
    setBillingType(existing.billingType);
    setAmount(existing.billingType === 'lifetime' ? '' : String(existing.amount));
    setStatus(existing.status);
    setStartDate(new Date(existing.startDate));
    setNotes(existing.notes ?? '');
    setLinkedCredentialId(existing.linkedCredentialId);
    navigation.setOptions({ title: `Edit ${existing.name}` });
    setHydrating(false);
  }, [id, navigation, router]);

  useEffect(() => {
    hydrateForm();
  }, [hydrateForm]);

  const selectedCredential = useMemo(
    () => credentials.find((cred) => cred.id === linkedCredentialId),
    [credentials, linkedCredentialId],
  );

  const onSubmit = async () => {
    if (!id) return;
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

    const finalAmount = needsAmount ? numericAmount : 0;

    const payload: Subscription = {
      id,
      name: name.trim(),
      category,
      billingType,
      amount: finalAmount,
      startDate: startDate.toISOString(),
      status,
      linkedCredentialId,
      notes: notes.trim() ? notes.trim() : undefined,
    };

    setSubmitting(true);
    try {
      await updateSubscription(payload);
      router.back();
    } catch (error) {
      console.warn('Failed to update subscription', error);
      Alert.alert('Update failed', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (hydrating) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { flex: 1, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={styles.label}>Loading subscription…</Text>
        </View>
      </SafeAreaView>
    );
  }

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
                  onPress={() => {
                    setBillingType(type);
                    if (type === 'lifetime') {
                      setAmount('');
                    }
                  }}
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
              editable={billingType !== 'lifetime'}
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
            <Text style={styles.label}>Linked Account</Text>
            <Pressable style={styles.staticValue} onPress={() => setPickerVisible(true)}>
              <Text style={styles.valueText}>
                {selectedCredential
                  ? `${selectedCredential.label} (${maskCredentialValue(selectedCredential)})`
                  : credentials.length
                    ? 'Choose account'
                    : 'No credentials added'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Start date</Text>
            <Pressable style={styles.staticValue} onPress={() => setShowPicker(true)}>
              <Text style={styles.dateText}>{startDate.toISOString().slice(0, 10)}</Text>
            </Pressable>
            {showPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                onChange={(event: DateTimePickerEvent, date?: Date) => {
                  if (event.type === 'dismissed') {
                    setShowPicker(false);
                    return;
                  }
                  if (date) {
                    setStartDate(date);
                  }
                  setShowPicker(false);
                }}
              />
            )}
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

          <Pressable
            style={[styles.submitButton, (submitting || hydrating) && styles.submitDisabled]}
            onPress={onSubmit}
            disabled={submitting || hydrating}>
            <Text style={styles.submitText}>{submitting ? 'Saving…' : 'Save changes'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Linked Account</Text>
            {credentials.length ? (
              <ScrollView style={styles.pickerList}>
                {credentials.map((cred) => (
                  <Pressable
                    key={cred.id}
                    style={[styles.pickerOption, linkedCredentialId === cred.id && styles.pickerOptionSelected]}
                    onPress={() => {
                      setLinkedCredentialId(cred.id);
                      setPickerVisible(false);
                    }}>
                    <View style={styles.pickerTextBlock}>
                      <Text style={styles.pickerLabel}>{cred.label}</Text>
                      <Text style={styles.pickerMask}>{maskCredentialValue(cred)}</Text>
                    </View>
                    {linkedCredentialId === cred.id ? <Text style={styles.pickerCheck}>✓</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noCredentials}>No credentials added</Text>
            )}
            <View style={styles.pickerActions}>
              {linkedCredentialId ? (
                <Pressable
                  style={[styles.pickerButton, styles.clearButton]}
                  onPress={() => {
                    setLinkedCredentialId(undefined);
                    setPickerVisible(false);
                  }}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : null}
              <Pressable style={[styles.pickerButton, styles.closeButton]} onPress={() => setPickerVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
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
  dateText: {
    fontSize: 16,
    color: '#111827',
  },
  valueText: {
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
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  pickerList: {
    maxHeight: 260,
    marginBottom: 12,
  },
  pickerOption: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerOptionSelected: {
    borderColor: '#111827',
    backgroundColor: '#f9fafb',
  },
  pickerTextBlock: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  pickerMask: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  pickerCheck: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 12,
    fontWeight: '700',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  pickerButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  clearButton: {
    backgroundColor: '#f3f4f6',
  },
  clearText: {
    color: '#111827',
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: '#111827',
  },
  closeText: {
    color: '#fff',
    fontWeight: '700',
  },
  noCredentials: {
    textAlign: 'center',
    color: '#6b7280',
    marginVertical: 16,
  },
});
