import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { BillingType, Subscription } from './db/subscriptions';

export type ReminderDaysBefore = 1 | 3 | 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const addMonths = (date: Date, count: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
};

const nextRenewalAfter = (startDate: Date, billingType: BillingType, afterDate: Date) => {
  if (billingType === 'lifetime') return null;

  const increment = billingType === 'monthly' ? 1 : 12;
  let next = new Date(startDate);
  let guard = 0;

  while (next <= afterDate && guard < 240) {
    next = addMonths(next, increment);
    guard += 1;
  }

  return next;
};

const ensureNotificationPermission = async () => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === 'granted') return true;

  const request = await Notifications.requestPermissionsAsync();
  return request.granted || request.status === 'granted';
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
};

export const scheduleSubscriptionReminder = async (subscription: Subscription): Promise<string | null> => {
  if (!subscription.reminderEnabled || !subscription.reminderDaysBefore) return null;
  if (subscription.billingType === 'lifetime' || subscription.status !== 'active') return null;

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return null;

  await ensureAndroidChannel();

  const start = new Date(subscription.startDate);
  const now = new Date();
  const incrementMonths = subscription.billingType === 'monthly' ? 1 : 12;
  let renewal = nextRenewalAfter(start, subscription.billingType, now);

  if (!renewal) return null;

  let reminderDate = new Date(renewal.getTime() - subscription.reminderDaysBefore * DAY_MS);
  let guard = 0;

  while (reminderDate <= now && guard < 240) {
    renewal = addMonths(renewal, incrementMonths);
    reminderDate = new Date(renewal.getTime() - subscription.reminderDaysBefore * DAY_MS);
    guard += 1;
  }

  if (reminderDate <= now) return null;

  const renewalDateText = renewal.toISOString().slice(0, 10);
  const secondsUntilReminder = Math.max(1, Math.round((reminderDate.getTime() - Date.now()) / 1000));

  const trigger: Notifications.TimeIntervalTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: secondsUntilReminder,
    repeats: false,
    channelId: Platform.OS === 'android' ? 'default' : undefined,
  };

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Subscription renewal reminder',
      body: `${subscription.name} renews on ${renewalDateText}`,
    },
    trigger,
  });

  return id;
};

export const cancelSubscriptionReminder = async (notificationId?: string | null) => {
  if (!notificationId) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Ignore cancellation errors
  }
};
