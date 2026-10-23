const DATABASE_NAME = 'exam-room';
const STORE_NAME = 'records';
const DATABASE_VERSION = 1;
const FALLBACK_PREFIX = 'exam-room:record:';

let databasePromise: Promise<IDBDatabase | undefined> | undefined;

function openDatabase(): Promise<IDBDatabase | undefined> {
  databasePromise ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
      request.onblocked = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
  return databasePromise;
}

function runRequest<Result>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  makeRequest: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = makeRequest(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? new Error('Saving failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Saving failed.'));
  });
}

export async function readRecord<Value>(key: string): Promise<Value | undefined> {
  const database = await openDatabase();
  if (database) {
    try {
      return (await runRequest(database, 'readonly', (store) => store.get(key))) as Value;
    } catch {
      return readFallback<Value>(key);
    }
  }
  return readFallback<Value>(key);
}

export async function writeRecord<Value>(key: string, value: Value): Promise<void> {
  const database = await openDatabase();
  if (database) {
    try {
      await runRequest(database, 'readwrite', (store) => store.put(value, key));
      return;
    } catch {
      writeFallback(key, value);
      return;
    }
  }
  writeFallback(key, value);
}

export async function deleteRecord(key: string): Promise<void> {
  const database = await openDatabase();
  if (database) {
    try {
      await runRequest(database, 'readwrite', (store) => store.delete(key));
    } catch {
      return deleteFallback(key);
    }
  }
  deleteFallback(key);
}

export async function listRecordKeys(prefix: string): Promise<string[]> {
  const database = await openDatabase();
  const keys = new Set(listFallbackKeys(prefix));
  if (database) {
    try {
      const storedKeys = await runRequest(database, 'readonly', (store) => store.getAllKeys());
      for (const key of storedKeys) {
        if (typeof key === 'string' && key.startsWith(prefix)) keys.add(key);
      }
    } catch {
      return [...keys];
    }
  }
  return [...keys];
}

function readFallback<Value>(key: string): Value | undefined {
  try {
    const text = window.localStorage.getItem(FALLBACK_PREFIX + key);
    return text === null ? undefined : (JSON.parse(text) as Value);
  } catch {
    return undefined;
  }
}

function writeFallback(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(FALLBACK_PREFIX + key, JSON.stringify(value));
  } catch {
    return;
  }
}

function deleteFallback(key: string): void {
  try {
    window.localStorage.removeItem(FALLBACK_PREFIX + key);
  } catch {
    return;
  }
}

function listFallbackKeys(prefix: string): string[] {
  try {
    return Object.keys(window.localStorage)
      .filter((key) => key.startsWith(FALLBACK_PREFIX + prefix))
      .map((key) => key.slice(FALLBACK_PREFIX.length));
  } catch {
    return [];
  }
}
