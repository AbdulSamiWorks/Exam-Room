import type { InStatement } from '@libsql/client';
import type { Database } from './connection.js';
import { migrations as allMigrations, type Migration } from './migrations.js';

const FOREIGN_KEY_GUARD_STATEMENTS = [
  `CREATE TABLE migration_foreign_key_guard (
    broken_references INTEGER NOT NULL CHECK (broken_references = 0)
  )`,
  `INSERT INTO migration_foreign_key_guard
     SELECT COUNT(*) FROM pragma_foreign_key_check`,
  'DROP TABLE migration_foreign_key_guard',
];

export async function runMigrations(
  database: Database,
  migrations: readonly Migration[] = allMigrations,
  getCurrentTime: () => number = Date.now,
): Promise<number[]> {
  await database.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    applied_at  INTEGER NOT NULL
  )`);

  const { rows } = await database.execute('SELECT id FROM schema_migrations');
  const alreadyAppliedIds = new Set(rows.map((row) => Number(row.id)));

  const pendingMigrations = [...migrations]
    .sort((first, second) => first.id - second.id)
    .filter((migration) => !alreadyAppliedIds.has(migration.id));

  for (const migration of pendingMigrations) {
    await applyMigration(database, migration, getCurrentTime());
  }

  return pendingMigrations.map((migration) => migration.id);
}

async function applyMigration(
  database: Database,
  migration: Migration,
  appliedAt: number,
): Promise<void> {
  const bookkeeping: InStatement = {
    sql: 'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)',
    args: [migration.id, migration.name, appliedAt],
  };

  if (migration.rebuildsTables) {
    await database.migrate([...migration.statements, ...FOREIGN_KEY_GUARD_STATEMENTS, bookkeeping]);
    return;
  }

  await database.batch([...migration.statements, bookkeeping], 'write');
}
