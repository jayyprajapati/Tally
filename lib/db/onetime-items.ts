import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export interface OneTimeItem {
  id: string | number;
  name: string;
  platform: string;
  category: string;
  amount: number;
  date: string | Date;
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

export async function initializeOneTimeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const db = await getDatabase();
    await db.execAsync(`CREATE TABLE IF NOT EXISTS one_time_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL
    );`);
    initialized = true;
  })();

  try {
    await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

const toStored = (item: OneTimeItem) => {
  const date = item.date instanceof Date ? item.date.toISOString() : item.date;
  return {
    ...item,
    id: `${item.id}`,
    date,
  };
};

const toItem = (row: any): OneTimeItem => ({
  id: row.id,
  name: row.name,
  platform: row.platform,
  category: row.category,
  amount: Number(row.amount),
  date: row.date,
});

export async function addOneTimeItem(item: OneTimeItem): Promise<void> {
  const record = toStored(item);
  if (!initialized) {
    await initializeOneTimeDatabase();
  }
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO one_time_items (id, name, platform, category, amount, date) VALUES (?, ?, ?, ?, ?, ?);`,
    [record.id, record.name, record.platform, record.category, record.amount, record.date],
  );
}

export async function getAllOneTimeItems(): Promise<OneTimeItem[]> {
  if (!initialized) {
    await initializeOneTimeDatabase();
  }
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM one_time_items ORDER BY date DESC;');
  return rows.map(toItem);
}

export async function deleteOneTimeItem(id: string | number): Promise<void> {
  if (!initialized) {
    await initializeOneTimeDatabase();
  }
  const db = await getDatabase();
  await db.runAsync('DELETE FROM one_time_items WHERE id = ?;', [id.toString()]);
}
