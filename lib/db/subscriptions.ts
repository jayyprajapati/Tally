import * as Notifications from 'expo-notifications';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export type BillingType = 'monthly' | 'yearly' | 'lifetime';
export type SubscriptionStatus = 'active' | 'wishlist';
export type SubscriptionAccessType = 'owned' | 'shared';

export interface Subscription {
  id: string | number;
  name: string;
  category: string;
  billingType: BillingType;
  amount: number;
  startDate: string | Date;
  status: SubscriptionStatus;
  accessType: SubscriptionAccessType;
  sharedMembers: string[];
  linkedCredentialId?: string;
  notes?: string;
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  reminderNotificationId?: string | null;
}

let dbPromise: Promise<SQLiteDatabase> | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('subscriptions.db');
  }
  return dbPromise;
};

export async function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await getDatabase();
    await db.execAsync(`CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      billingType TEXT NOT NULL,
      amount REAL NOT NULL,
      startDate TEXT NOT NULL,
      status TEXT NOT NULL,
      accessType TEXT NOT NULL DEFAULT 'owned',
      sharedMembers TEXT,
      linkedCredentialId TEXT,
      notes TEXT,
      reminderEnabled INTEGER NOT NULL DEFAULT 0,
      reminderDaysBefore INTEGER,
      reminderNotificationId TEXT
    );`);
    await ensureNewColumns(db);
    initialized = true;
  })();

  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

const ensureNewColumns = async (db: SQLiteDatabase) => {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(subscriptions);');
  const names = columns.map((c) => c.name);
  const addIfMissing = async (name: string, sql: string) => {
    if (!names.includes(name)) {
      try {
        await db.execAsync(sql);
      } catch (error: any) {
        if (typeof error?.message === 'string' && error.message.includes('duplicate column name')) {
          return;
        }
        throw error;
      }
    }
  };

  await addIfMissing('reminderEnabled', 'ALTER TABLE subscriptions ADD COLUMN reminderEnabled INTEGER NOT NULL DEFAULT 0;');
  await addIfMissing('reminderDaysBefore', 'ALTER TABLE subscriptions ADD COLUMN reminderDaysBefore INTEGER;');
  await addIfMissing('reminderNotificationId', 'ALTER TABLE subscriptions ADD COLUMN reminderNotificationId TEXT;');
  await addIfMissing('accessType', "ALTER TABLE subscriptions ADD COLUMN accessType TEXT NOT NULL DEFAULT 'owned';");
  await addIfMissing('sharedMembers', 'ALTER TABLE subscriptions ADD COLUMN sharedMembers TEXT;');
};

const toStored = (subscription: Subscription) => {
  const startDate =
    subscription.startDate instanceof Date
      ? subscription.startDate.toISOString()
      : subscription.startDate;

  return {
    ...subscription,
    id: `${subscription.id}`,
    startDate,
    accessType: subscription.accessType ?? 'owned',
    sharedMembers: JSON.stringify(subscription.sharedMembers ?? []),
    reminderEnabled: subscription.reminderEnabled ? 1 : 0,
    reminderDaysBefore: subscription.reminderDaysBefore ?? null,
    reminderNotificationId: subscription.reminderNotificationId ?? null,
  };
};

const toSubscription = (row: any): Subscription => ({
  id: row.id,
  name: row.name,
  category: row.category,
  billingType: row.billingType as BillingType,
  amount: Number(row.amount),
  startDate: row.startDate,
  status: row.status as SubscriptionStatus,
  accessType: (row.accessType as SubscriptionAccessType) ?? 'owned',
  sharedMembers: (() => {
    if (!row.sharedMembers) return [];
    try {
      const parsed = JSON.parse(row.sharedMembers);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    } catch (error) {
      return [];
    }
  })(),
  linkedCredentialId: row.linkedCredentialId ?? undefined,
  notes: row.notes ?? undefined,
  reminderEnabled: Boolean(row.reminderEnabled),
  reminderDaysBefore:
    row.reminderDaysBefore === null || row.reminderDaysBefore === undefined
      ? undefined
      : Number(row.reminderDaysBefore),
  reminderNotificationId: row.reminderNotificationId ?? undefined,
});

export async function addSubscription(subscription: Subscription): Promise<void> {
  const record = toStored(subscription);
  if (!initialized) {
    await initializeDatabase();
  }
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO subscriptions (
      id, name, category, billingType, amount, startDate, status, accessType, sharedMembers, linkedCredentialId, notes, reminderEnabled, reminderDaysBefore, reminderNotificationId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      record.id,
      record.name,
      record.category,
      record.billingType,
      record.amount,
      record.startDate,
      record.status,
      record.accessType,
      record.sharedMembers,
      record.linkedCredentialId ?? null,
      record.notes ?? null,
      record.reminderEnabled ?? 0,
      record.reminderDaysBefore ?? null,
      record.reminderNotificationId ?? null,
    ],
  );
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  if (!initialized) {
    await initializeDatabase();
  }
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM subscriptions ORDER BY startDate DESC;');
  return rows.map(toSubscription);
}

export async function getSubscriptionById(id: string | number): Promise<Subscription | null> {
  if (!initialized) {
    await initializeDatabase();
  }
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM subscriptions WHERE id = ?;', [id.toString()]);
  return row ? toSubscription(row) : null;
}

export async function updateSubscription(subscription: Subscription): Promise<void> {
  const record = toStored(subscription);
  if (!initialized) {
    await initializeDatabase();
  }
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE subscriptions
      SET name = ?, category = ?, billingType = ?, amount = ?, startDate = ?, status = ?, accessType = ?, sharedMembers = ?, linkedCredentialId = ?, notes = ?, reminderEnabled = ?, reminderDaysBefore = ?, reminderNotificationId = ?
      WHERE id = ?;`,
    [
      record.name,
      record.category,
      record.billingType,
      record.amount,
      record.startDate,
      record.status,
      record.accessType,
      record.sharedMembers,
      record.linkedCredentialId ?? null,
      record.notes ?? null,
      record.reminderEnabled ?? 0,
      record.reminderDaysBefore ?? null,
      record.reminderNotificationId ?? null,
      record.id,
    ],
  );
}

export async function deleteSubscription(id: string | number): Promise<void> {
  const existing = await getSubscriptionById(id);
  if (!initialized) {
    await initializeDatabase();
  }
  const db = await getDatabase();
  if (existing?.reminderNotificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(existing.reminderNotificationId);
    } catch (error) {
      // ignore cancellation issues
    }
  }
  await db.runAsync('DELETE FROM subscriptions WHERE id = ?;', [id.toString()]);
}
