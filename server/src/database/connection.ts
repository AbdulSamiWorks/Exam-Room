import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export type Database = Client;

const LOCAL_FILE_URL_PREFIX = 'file:';

export function openDatabase(url: string, authToken?: string): Database {
  if (url.startsWith(LOCAL_FILE_URL_PREFIX)) {
    const databaseFilePath = url.slice(LOCAL_FILE_URL_PREFIX.length);
    mkdirSync(path.dirname(databaseFilePath), { recursive: true });
  }
  return createClient({ url, authToken });
}
