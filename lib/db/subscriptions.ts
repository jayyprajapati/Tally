import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export type BillingType = 'monthly' | 'yearly' | 'lifetime';
export type SubscriptionStatus = 'active' | 'wishlist';

export interface Subscription {
  id: string | number;
  name: string;
  category: string;
  billingType: BillingType;
  amount: number;
  startDate: string | Date;
  status: SubscriptionStatus;
  linkedCredentialId?: string;
  notes?: string;
}

let dbPromise: Promise<SQLiteDatabase> | null = null;
let initialized = false;

const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('subscriptions.db');
  }
  return dbPromise;
};

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    billingType TEXT NOT NULL,
    amount REAL NOT NULL,
    startDate TEXT NOT NULL,
    status TEXT NOT NULL,
    linkedCredentialId TEXT,
    notes TEXT
  );`);
  initialized = true;
}

const toStored = (subscription: Subscription) => {
  const startDate =
    subscription.startDate instanceof Date
      ? subscription.startDate.toISOString()
      : subscription.startDate;

  return {
    ...subscription,
    id: `${subscription.id}`,
    startDate,
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
  linkedCredentialId: row.linkedCredentialId ?? undefined,
  notes: row.notes ?? undefined,
});

export async function addSubscription(subscription: Subscription): Promise<void> {
  const record = toStored(subscription);
  if (!initialized) {
    await initializeDatabase();
  }
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO subscriptions (
      id, name, category, billingType, amount, startDate, status, linkedCredentialId, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      record.id,
      record.name,
      record.category,
      record.billingType,
      record.amount,
      record.startDate,
      record.status,
      record.linkedCredentialId ?? null,
      record.notes ?? null,
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
      SET name = ?, category = ?, billingType = ?, amount = ?, startDate = ?, status = ?, linkedCredentialId = ?, notes = ?
      WHERE id = ?;`,
    [
      record.name,
      record.category,
      record.billingType,
      record.amount,
      record.startDate,
      record.status,
      record.linkedCredentialId ?? null,
      record.notes ?? null,
      record.id,
    ],
  );
}

export async function deleteSubscription(id: string | number): Promise<void> {
  if (!initialized) {
    await initializeDatabase();
  }
  const db = await getDatabase();
  await db.runAsync('DELETE FROM subscriptions WHERE id = ?;', [id.toString()]);
}
