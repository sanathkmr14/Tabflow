import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface SavedTab {
  url: string;
  title: string;
  favIconUrl?: string;
  isStarred?: boolean;
  scheduledOpenTimes?: number[]; // array of epoch timestamps
  scheduledCloseTimes?: number[]; // array of epoch timestamps
}

export interface WorkspaceSession {
  id: string;
  name: string;
  timestamp: number;
  tabs: SavedTab[];
  contextSummary: string; // AI generated summary of what this session is about
  tags?: string[];
  isPinned?: boolean;
  scheduledOpenTimes?: number[];
  scheduledCloseTimes?: number[];
  isLocked?: boolean;
  password?: string;
  passwordSalt?: string; // Random salt for PBKDF2 hashing (new passwords only)
  recoveryWord?: string;
  autoLockEnabled?: boolean;
  shareLink?: string;
}

export interface Settings {
  key: string;
  value: unknown;
}

interface TabflowSchema extends DBSchema {
  sessions: {
    key: string; // id
    value: WorkspaceSession;
    indexes: { 'by-timestamp': number };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

let dbPromise: Promise<IDBPDatabase<TabflowSchema>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TabflowSchema>('tabflow-db', 2, {
      upgrade(db, oldVersion) {
        // Version 1: Initial schema
        if (oldVersion < 1) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by-timestamp', 'timestamp');
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        // Version 2: passwordSalt field added to sessions (no schema change needed,
        // new field is optional and will be populated on next password set/change)
      },
    });
  }
  return dbPromise;
}

export async function saveSession(session: WorkspaceSession) {
  const db = await getDB();
  await db.put('sessions', session);
}

export async function getSessions() {
  const db = await getDB();
  return db.getAllFromIndex('sessions', 'by-timestamp');
}

export async function deleteSession(id: string) {
  const db = await getDB();
  await db.delete('sessions', id);
}

export async function setSetting(key: string, value: unknown) {
  const db = await getDB();
  await db.put('settings', { key, value });
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const result = await db.get('settings', key);
  return result ? (result.value as T) : defaultValue;
}
