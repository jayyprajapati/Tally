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
import { colors, spacing, typography } from '@/theme';

const categories = ['General', 'Entertainment', 'Productivity', 'Fitness', 'Finance', 'Education', 'Other'];
const billingTypes: Subscription['billingType'][] = ['weekly', 'monthly', 'yearly', 'lifetime'];
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

const isStopDateAligned = (billingType: Subscription['billingType'], start: Date, stop: Date) => {
  if (stop <= start) return false;

  if (billingType === 'weekly') {
    const diffDays = Math.round((stop.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays % 7 === 0;
  }

  if (billingType === 'monthly') {
    return start.getDate() === stop.getDate();
  }

  if (billingType === 'yearly') {
    return start.getDate() === stop.getDate() && start.getMonth() === stop.getMonth();
  }

  return true;
};

const getNextAlignedStopDate = (billingType: Subscription['billingType'], start: Date) => {
  const next = new Date(start);

  if (billingType === 'weekly') {
    next.setDate(start.getDate() + 7);
    return next;
  }

  if (billingType === 'monthly') {
    next.setMonth(start.getMonth() + 1);
    return next;
  }

  if (billingType === 'yearly') {
    next.setFullYear(start.getFullYear() + 1);
    return next;
  }

  next.setDate(start.getDate() + 1);
  return next;
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
  const [userPaying, setUserPaying] = useState<boolean>(true);
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
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
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
      setUserPaying(existing.userPaying !== false);
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
      setStopDate(getNextAlignedStopDate(billingType, startDate));
      return;
    }

    if (!isStopDateAligned(billingType, startDate, stopDate)) {
      setStopDate(getNextAlignedStopDate(billingType, startDate));
    }
  }, [billingType, hasStopDate, startDate, stopDate]);

  const onSubmit = async () => {
    if (hydrating) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a subscription name.');
      return;
    }

    const numericAmount = parseFloat(amount);
    const paying = !(accessType === 'shared' && !userPaying);
    const needsAmount = billingType !== 'lifetime' && paying;

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

    if (hasStopDate && stopDate && !isStopDateAligned(billingType, startDate, stopDate)) {
      Alert.alert('Invalid stop date', 'Stop date must align with the selected billing cycle.');
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
      userPaying: paying,
      sharedMembers: effectiveSharedMembers,
      hasStopDate,
      stopDate: hasStopDate && stopDate ? stopDate.toISOString() : null,
      linkedCredentialId,
      notes: notes.trim() ? notes.trim() : undefined,
      reminderEnabled,
      reminderDaysBefore: reminderEnabled ? reminderDaysBefore : undefined,
      reminderNotificationId,
    };

    const shouldScheduleReminder = reminderEnabled && billingType !== 'lifetime' && status === 'active' && paying;
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
              onChangeText={(text) => {
                setName(text);
                setNameLocked(true);
              }}
              placeholder="e.g. Netflix"
              placeholderTextColor="#6b7280"
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Category</Text>
            <Pressable style={styles.selectorField} onPress={() => setCategoryPickerVisible(true)}>
              <Text style={styles.selectorValue}>{category}</Text>
              <Text style={styles.selectorHint}>Change</Text>
            </Pressable>
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
              placeholderTextColor="#6b7280"
              keyboardType="decimal-pad"
              style={styles.input}
              editable={billingType !== 'lifetime' && !(accessType === 'shared' && !userPaying)}
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
                      setUserPaying(true);
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
              <Text style={styles.label}>Who is paying?</Text>
              <View style={styles.segmentRow}>
                <Pressable
                  style={[styles.segment, userPaying && styles.segmentSelected]}
                  onPress={() => setUserPaying(true)}
                >
                  <Text style={[styles.segmentText, userPaying && styles.segmentTextSelected]}>You</Text>
                </Pressable>
                <Pressable
                  style={[styles.segment, !userPaying && styles.segmentSelected]}
                  onPress={() => {
                    setUserPaying(false);
                    setAmount('');
                    setAmountLocked(true);
                  }}
                >
                  <Text style={[styles.segmentText, !userPaying && styles.segmentTextSelected]}>Someone else</Text>
                </Pressable>
              </View>
              {!userPaying ? (
                <Text style={styles.helperText}>Marked as Shared (Not Paid by You). Amount is excluded from spend.</Text>
              ) : null}
            </View>
          ) : null}

          {accessType === 'shared' ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Who is sharing this with you?</Text>
              <View style={styles.memberList}>
                {sharedMembers.map((member, index) => (
                  <View style={styles.memberRow} key={`${index}-${member}`}>
                    <TextInput
                      style={[styles.input, styles.memberInput]}
                      placeholder="Name"
                      placeholderTextColor="#6b7280"
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
                    setStopDate(getNextAlignedStopDate(billingType, startDate));
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
                        if (isStopDateAligned(billingType, startDate, date)) {
                          setStopDate(date);
                        } else {
                          Alert.alert('Invalid stop date', 'Stop date must align with the billing cycle.');
                        }
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
              placeholderTextColor="#6b7280"
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

      <Modal visible={categoryPickerVisible} transparent animationType="fade" onRequestClose={() => setCategoryPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCategoryPickerVisible(false)}>
          <Pressable style={styles.selectorModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Select category</Text>
            <ScrollView style={styles.pickerList}>
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.modalOption, category === cat && styles.modalOptionActive]}
                  onPress={() => {
                    setCategory(cat as Subscription['category']);
                    setCategoryLocked(true);
                    setCategoryPickerVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, category === cat && styles.modalOptionTextActive]}>{cat}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    ...typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundPrimary,
    fontSize: 16,
  },
  selectorField: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.backgroundPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  selectorHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.backgroundPrimary,
    alignItems: 'center',
  },
  segmentSelected: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.textPrimary,
  },
  segmentText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  segmentTextSelected: {
    color: colors.backgroundPrimary,
  },
  staticValue: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.backgroundPrimary,
    fontSize: 16,
    color: colors.textPrimary,
  },
  dateText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  valueText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  submitButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: spacing.md,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: colors.backgroundPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  pickerCard: {
    width: '100%',
    backgroundColor: colors.backgroundPrimary,
    borderRadius: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pickerTitle: {
    ...typography.sectionTitle,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  pickerList: {
    maxHeight: 260,
    marginBottom: spacing.md,
  },
  pickerOption: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerOptionSelected: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
  },
  pickerTextBlock: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pickerMask: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  pickerCheck: {
    fontSize: 16,
    color: colors.textPrimary,
    marginLeft: spacing.md,
    fontWeight: '700',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  selectorModalCard: {
    width: '100%',
    backgroundColor: colors.backgroundPrimary,
    borderRadius: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  modalOption: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.sm,
  },
  modalOptionActive: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.backgroundSecondary,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalOptionTextActive: {
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  pickerButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
  },
  clearButton: {
    backgroundColor: colors.backgroundSecondary,
  },
  clearText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  closeButton: {
    backgroundColor: colors.textPrimary,
  },
  closeText: {
    color: colors.backgroundPrimary,
    fontWeight: '700',
  },
  noCredentials: {
    textAlign: 'center',
    color: colors.textMuted,
    marginVertical: spacing.lg,
  },
  memberList: {
    gap: spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  memberInput: {
    flex: 1,
  },
  memberRemove: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: spacing.sm,
  },
  memberRemoveText: {
    color: colors.accentPrimary,
    fontWeight: '700',
  },
  addMemberButton: {
    paddingVertical: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
  },
  addMemberText: {
    color: colors.backgroundPrimary,
    fontWeight: '700',
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
