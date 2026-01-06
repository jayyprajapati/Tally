import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
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
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Credential, getAllCredentials, maskCredentialValue } from '@/lib/db/credentials';
import {
    Subscription,
    addSubscription,
    getSubscriptionById,
    updateSubscription,
} from '@/lib/db/subscriptions';
import { ReminderDaysBefore, cancelSubscriptionReminder, scheduleSubscriptionReminder } from '@/lib/reminders';

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const billingTypes: Subscription['billingType'][] = ['monthly', 'yearly', 'lifetime'];
const statuses: Subscription['status'][] = ['active', 'wishlist'];
const reminderOptions: ReminderDaysBefore[] = [1, 3, 7];

type SubscriptionSuggestion = {
  category: Subscription['category'];
  billingType: Extract<Subscription['billingType'], 'monthly' | 'yearly'>;
  amount: number;
};

const subscriptionSuggestions: Record<string, SubscriptionSuggestion> = {
  netflix: { category: 'Entertainment', billingType: 'monthly', amount: 15.49 },
  spotify: { category: 'Entertainment', billingType: 'monthly', amount: 10.99 },
  'amazon prime': { category: 'Entertainment', billingType: 'yearly', amount: 139 },
  'amazon prime video': { category: 'Entertainment', billingType: 'monthly', amount: 8.99 },
  'youtube premium': { category: 'Entertainment', billingType: 'monthly', amount: 13.99 },
  'google one': { category: 'Productivity', billingType: 'monthly', amount: 1.99 },
  icloud: { category: 'Productivity', billingType: 'monthly', amount: 0.99 },
  'microsoft 365': { category: 'Productivity', billingType: 'yearly', amount: 99.99 },
  coursera: { category: 'Education', billingType: 'monthly', amount: 59 },
  udemy: { category: 'Education', billingType: 'monthly', amount: 29.99 },
  chatgpt: { category: 'Productivity', billingType: 'monthly', amount: 20 },
};

const normalizeName = (value: string) => value.trim().toLowerCase();

const findSuggestion = (value: string): SubscriptionSuggestion | null => {
  const normalized = normalizeName(value);
  if (normalized.length < 3) return null;

  const entry = Object.entries(subscriptionSuggestions).find(([key]) =>
    key.startsWith(normalized) || normalized.startsWith(key),
  );

  return entry ? entry[1] : null;
};

export default function AddSubscriptionScreen() {
  const router = useRouter();
  const { mode, id } = useLocalSearchParams<{ mode?: string; id?: string }>();
  const isEdit = mode === 'edit' && !!id;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Subscription['category']>('General');
  const [billingType, setBillingType] = useState<Subscription['billingType']>('monthly');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<Subscription['status']>('active');
  const [accessType, setAccessType] = useState<Subscription['accessType']>('owned');
  const [sharedMembers, setSharedMembers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [hasStopDate, setHasStopDate] = useState(false);
  const [stopDate, setStopDate] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hydrating, setHydrating] = useState<boolean>(isEdit);
  const [showPicker, setShowPicker] = useState(false);
  const [showStopPicker, setShowStopPicker] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [linkedCredentialId, setLinkedCredentialId] = useState<string | undefined>(undefined);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [categoryLocked, setCategoryLocked] = useState(false);
  const [billingLocked, setBillingLocked] = useState(false);
  const [amountLocked, setAmountLocked] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDaysBefore, setReminderDaysBefore] = useState<ReminderDaysBefore>(3);
  const [reminderNotificationId, setReminderNotificationId] = useState<string | undefined>(undefined);

  const loadCredentials = useCallback(async () => {
    const list = await getAllCredentials();
    setCredentials(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCredentials();
    }, [loadCredentials]),
  );

  useEffect(() => {
    if (!isEdit || !id) {
      setHydrating(false);
      return;
    }

    let active = true;
    (async () => {
      const existing = await getSubscriptionById(id);
      if (!active) return;
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
      setAccessType(existing.accessType ?? 'owned');
      setSharedMembers((existing.sharedMembers ?? []).slice(0, 10));
      setStartDate(new Date(existing.startDate));
      setHasStopDate(Boolean(existing.hasStopDate));
      setStopDate(existing.stopDate ? new Date(existing.stopDate) : null);
      setNotes(existing.notes ?? '');
      setLinkedCredentialId(existing.linkedCredentialId);
      setReminderEnabled(Boolean(existing.reminderEnabled));
      setReminderDaysBefore((existing.reminderDaysBefore as ReminderDaysBefore) ?? 3);
      setReminderNotificationId(existing.reminderNotificationId ?? undefined);
      setHydrating(false);
    })();

    return () => {
      active = false;
    };
  }, [id, isEdit, router]);

  const selectedCredential = useMemo(
    () => credentials.find((cred) => cred.id === linkedCredentialId),
    [credentials, linkedCredentialId],
  );

  const handleNameChange = (value: string) => {
    setName(value);
  };

  useEffect(() => {
    if (isEdit) return;

    const suggestion = findSuggestion(name);
    if (!suggestion) return;

    if (!categoryLocked) {
      setCategory(suggestion.category);
    }

    if (!billingLocked) {
      setBillingType(suggestion.billingType);
    }

    const effectiveBillingType = billingLocked ? billingType : suggestion.billingType;

    if (!amountLocked) {
      if (billingLocked && billingType !== suggestion.billingType) {
        return;
      }
      if (effectiveBillingType === 'lifetime') {
        setAmount('');
      } else {
        setAmount(String(suggestion.amount));
      }
    }
  }, [amountLocked, billingLocked, billingType, categoryLocked, isEdit, name]);

  useEffect(() => {
    if (!hasStopDate || !stopDate) return;
    if (stopDate <= startDate) {
      const nextDay = new Date(startDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setStopDate(nextDay);
    }
  }, [hasStopDate, startDate, stopDate]);

  const onSubmit = async () => {
    if (hydrating) return;
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

    const resolvedAmount = Number.isNaN(numericAmount) ? 0 : numericAmount;
    const finalAmount = needsAmount ? resolvedAmount : 0;
    const cleanedMembers = sharedMembers
      .map((member) => member.trim())
      .filter(Boolean)
      .slice(0, 10);
    const effectiveSharedMembers = accessType === 'shared' ? cleanedMembers : [];

    if (hasStopDate && !stopDate) {
      Alert.alert('Stop date required', 'Select a planned stop date or turn off the toggle.');
      return;
    }

    if (hasStopDate && stopDate && stopDate <= startDate) {
      Alert.alert('Invalid stop date', 'Stop date must be after the start date.');
      return;
    }

    const basePayload: Subscription = {
      id: isEdit && id ? id : Date.now().toString(),
      name: name.trim(),
      category,
      billingType,
      amount: finalAmount,
      startDate: startDate.toISOString(),
      status,
      accessType,
      sharedMembers: effectiveSharedMembers,
      hasStopDate,
      stopDate: hasStopDate && stopDate ? stopDate.toISOString() : null,
      linkedCredentialId,
      notes: notes.trim() ? notes.trim() : undefined,
      reminderEnabled,
      reminderDaysBefore: reminderEnabled ? reminderDaysBefore : undefined,
      reminderNotificationId,
    };

    const shouldScheduleReminder = reminderEnabled && billingType !== 'lifetime' && status === 'active';
    let nextNotificationId = reminderNotificationId;

    if (reminderNotificationId) {
      await cancelSubscriptionReminder(reminderNotificationId);
      nextNotificationId = undefined;
    }

    if (shouldScheduleReminder) {
      const scheduledId = await scheduleSubscriptionReminder({
        ...basePayload,
        reminderEnabled: true,
        reminderDaysBefore,
        reminderNotificationId: undefined,
      });

      if (!scheduledId) {
        Alert.alert('Enable notifications', 'Allow notification permissions to receive renewal reminders.');
      }

      nextNotificationId = scheduledId ?? undefined;
    }

    const payload: Subscription = {
      ...basePayload,
      reminderEnabled: shouldScheduleReminder && !!nextNotificationId,
      reminderDaysBefore: shouldScheduleReminder && !!nextNotificationId ? reminderDaysBefore : undefined,
      reminderNotificationId: nextNotificationId,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateSubscription(payload);
      } else {
        await addSubscription(payload);
      }
      router.back();
    } catch (error) {
      console.warn('Failed to save subscription', error);
      Alert.alert('Save failed', 'Please try again.');
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
              onChangeText={handleNameChange}
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
                  onPress={() => {
                    setCategory(cat as Subscription['category']);
                    setCategoryLocked(true);
                  }}
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
                    setBillingLocked(true);
                    setBillingType(type);
                    if (type === 'lifetime') {
                      setAmount('');
                      setAmountLocked(true);
                      setReminderEnabled(false);
                      setReminderNotificationId(undefined);
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
              onChangeText={(text) => {
                setAmount(text);
                setAmountLocked(true);
              }}
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
            <Text style={styles.label}>Access Type</Text>
            <View style={styles.segmentRow}>
              {(['owned', 'shared'] as Subscription['accessType'][]).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    setAccessType(type);
                    if (type === 'owned') {
                      setSharedMembers([]);
                    }
                  }}
                  style={[styles.segment, accessType === type && styles.segmentSelected]}
                >
                  <Text style={[styles.segmentText, accessType === type && styles.segmentTextSelected]}>
                    {type === 'owned' ? 'Owned' : 'Shared'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {accessType === 'shared' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Who is sharing this with you?</Text>
              <View style={styles.memberList}>
                {sharedMembers.map((member, index) => (
                  <View style={styles.memberRow} key={`${index}-${member}`}>
                    <TextInput
                      style={[styles.input, styles.memberInput]}
                      placeholder="Name"
                      value={member}
                      onChangeText={(text) =>
                        setSharedMembers((prev) => {
                          const next = [...prev];
                          next[index] = text;
                          return next;
                        })
                      }
                    />
                    <Pressable
                      style={styles.memberRemove}
                      onPress={() => setSharedMembers((prev) => prev.filter((_, i) => i !== index))}
                      hitSlop={8}
                    >
                      <Text style={styles.memberRemoveText}>Remove</Text>
                    </Pressable>
                  </View>
                ))}
                {sharedMembers.length < 10 ? (
                  <Pressable
                    style={[styles.addMemberButton, sharedMembers.length >= 10 && styles.submitDisabled]}
                    onPress={() => setSharedMembers((prev) => [...prev, ''])}
                  >
                    <Text style={styles.addMemberText}>Add member</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

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
            <View style={styles.reminderHeader}>
              <Text style={styles.label}>Planned to stop</Text>
              <Switch
                value={hasStopDate}
                onValueChange={(next) => {
                  setHasStopDate(next);
                  if (!next) {
                    setStopDate(null);
                    setShowStopPicker(false);
                  } else if (!stopDate) {
                    const tomorrow = new Date(startDate);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    setStopDate(tomorrow);
                  }
                }}
              />
            </View>
            {hasStopDate ? (
              <>
                <Pressable style={styles.staticValue} onPress={() => setShowStopPicker(true)}>
                  <Text style={styles.dateText}>
                    {stopDate ? stopDate.toISOString().slice(0, 10) : 'Select stop date'}
                  </Text>
                </Pressable>
                {showStopPicker && (
                  <DateTimePicker
                    value={stopDate ?? new Date(startDate.getTime() + 24 * 60 * 60 * 1000)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (event.type === 'dismissed') {
                        setShowStopPicker(false);
                        return;
                      }
                      if (date) {
                        setStopDate(date);
                      }
                      setShowStopPicker(false);
                    }}
                  />
                )}
              </>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.reminderHeader}>
              <Text style={styles.label}>Renewal reminder</Text>
              <Switch
                value={reminderEnabled}
                onValueChange={(enabled) => {
                  if (billingType === 'lifetime') {
                    setReminderEnabled(false);
                    return;
                  }
                  setReminderEnabled(enabled);
                  if (!enabled) {
                    setReminderNotificationId(undefined);
                  }
                }}
              />
            </View>
            {reminderEnabled ? (
              <View style={styles.chipRow}>
                {reminderOptions.map((days) => (
                  <Pressable
                    key={days}
                    onPress={() => setReminderDaysBefore(days)}
                    style={[styles.chip, reminderDaysBefore === days && styles.chipSelected]}>
                    <Text style={[styles.chipText, reminderDaysBefore === days && styles.chipTextSelected]}>
                      {days} day{days === 1 ? '' : 's'} before
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
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
            <Text style={styles.submitText}>{submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Save subscription'}</Text>
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
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  memberList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  memberInput: {
    flex: 1,
  },
  memberRemove: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
  },
  memberRemoveText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  addMemberButton: {
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  addMemberText: {
    color: '#fff',
    fontWeight: '700',
  },
});
