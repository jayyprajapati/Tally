import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

export type CredentialType = 'personalEmail' | 'workEmail' | 'mobileNumber' | 'custom' | 'card';

export interface Credential {
  id: string;
  type: CredentialType;
  label: string;
  value: string;
}

let dbPromise: Promise<SQLiteDatabase> | null = null;
let initialized = false;

const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('subscriptions.db');
  }
  return dbPromise;
};

export async function initializeCredentialDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL
  );`);
  initialized = true;
}

const ensureDb = async () => {
  if (!initialized) {
    await initializeCredentialDatabase();
  }
};

export const BUILT_IN_CREDENTIAL_IDS = {
  personalEmail: 'personal-email',
  workEmail: 'work-email',
  mobileNumber: 'mobile-number',
} as const;

type BuiltInKey = keyof typeof BUILT_IN_CREDENTIAL_IDS;

const maskEmail = (value: string) => {
  const [local, domain] = value.split('@');
  if (!domain) {
    return '******';
  }
  const prefix = local.slice(0, 2) || local;
  return `${prefix}****@${domain}`;
};

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  const tail = digits.slice(-4) || '0000';
  return `******${tail}`;
};

const maskGeneric = (value: string) => {
  if (!value) return '******';
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '****';
  const tail = trimmed.slice(-4);
  return `****${tail}`;
};

export const maskCredentialValue = (credential: Credential): string => {
  if (credential.type === 'personalEmail' || credential.type === 'workEmail') {
    return maskEmail(credential.value);
  }
  if (credential.type === 'mobileNumber') {
    return maskPhone(credential.value);
  }
  if (credential.type === 'card') {
    const digits = credential.value.replace(/\D/g, '').slice(-4) || credential.value.slice(-4);
    return `**** ${digits.padStart(4, '*')}`;
  }
  return maskGeneric(credential.value);
};

export async function upsertCredential(credential: Credential): Promise<void> {
  await ensureDb();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO credentials (id, type, label, value) VALUES (?, ?, ?, ?);`,
    [credential.id, credential.type, credential.label, credential.value],
  );
}

export async function deleteCredential(id: string): Promise<void> {
  await ensureDb();
  const db = await getDatabase();
  await db.runAsync('DELETE FROM credentials WHERE id = ?;', [id]);
}

export async function getAllCredentials(): Promise<Credential[]> {
  await ensureDb();
  const db = await getDatabase();
  const rows = await db.getAllAsync<Credential>('SELECT * FROM credentials ORDER BY label ASC;');
  return rows.map((row) => ({ ...row, id: row.id }));
}

export async function getCredentialById(id: string): Promise<Credential | undefined> {
  await ensureDb();
  const db = await getDatabase();
  const row = await db.getFirstAsync<Credential>('SELECT * FROM credentials WHERE id = ?;', [id]);
  return row ?? undefined;
}
