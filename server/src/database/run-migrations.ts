import type { Database } from './connection.js';
import { migrations as allMigrations, type Migration } from './migrations.js';

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
    await database.batch(
      [
        ...migration.statements,
        {
          sql: 'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)',
          args: [migration.id, migration.name, getCurrentTime()],
        },
      ],
      'write',
    );
  }

  return pendingMigrations.map((migration) => migration.id);
}
