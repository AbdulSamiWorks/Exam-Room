import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Database } from '../src/database/connection.js';
import { migrations } from '../src/database/migrations.js';
import { runMigrations } from '../src/database/run-migrations.js';
import { IN_MEMORY_DATABASE_URL } from './support/test-context.js';

describe('runMigrations', () => {
  let database: Database;

  beforeEach(() => {
    database = openDatabase(IN_MEMORY_DATABASE_URL);
  });
  afterEach(() => database.close());

  it('has unique, increasing migration ids', () => {
    const ids = migrations.map((migration) => migration.id);
    expect(ids).toEqual([...new Set(ids)].sort((first, second) => first - second));
  });

  it('applies all migrations once and is safe to run again', async () => {
    expect(await runMigrations(database)).toEqual(migrations.map((migration) => migration.id));
    expect(await runMigrations(database)).toEqual([]);
  });

  it('creates the expected tables', async () => {
    await runMigrations(database);
    const { rows } = await database.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(rows.map((row) => row.name)).toEqual(
      expect.arrayContaining(['subjects', 'tests', 'test_pages', 'attempts', 'exits']),
    );
  });

  it('rolls back a migration that fails part-way', async () => {
    const brokenMigration = {
      id: 1,
      name: 'broken',
      statements: ['CREATE TABLE half_done (id INTEGER)', 'THIS IS NOT SQL'],
    };

    await expect(runMigrations(database, [brokenMigration])).rejects.toThrow();

    const { rows } = await database.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'half_done'",
    );
    expect(rows).toHaveLength(0);
  });
});
