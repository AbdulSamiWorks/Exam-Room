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

  it('gives existing attempts version 0 when migration 2 adds the version column', async () => {
    const initialSchemaOnly = migrations.filter((migration) => migration.id === 1);
    await runMigrations(database, initialSchemaOnly);
    await database.batch(
      [
        "INSERT INTO subjects (id, name, created_at) VALUES (1, 'Physics', 0)",
        `INSERT INTO tests (id, code, subject_id, title, duration_minutes, allowed_exits,
                            page_count, created_at)
         VALUES (1, 'K7M2QX', 1, 'Quiz', 30, 1, 1, 0)`,
        `INSERT INTO attempts (test_id, student_name, roll_no, roll_no_key, token_hash, status,
                               started_at, deadline_at)
         VALUES (1, 'Ayesha', '17', '17', 'hash', 'in_progress', 0, 1800000)`,
      ],
      'write',
    );

    expect(await runMigrations(database)).toEqual([2, 3]);

    const { rows } = await database.execute('SELECT version FROM attempts');
    expect(rows.map((row) => row.version)).toEqual([0]);
  });

  it('keeps tests made before migration 3 open from the time they were created', async () => {
    const schemaBeforeSchedules = migrations.filter((migration) => migration.id < 3);
    await runMigrations(database, schemaBeforeSchedules);
    await database.batch(
      [
        "INSERT INTO subjects (id, name, created_at) VALUES (1, 'Physics', 0)",
        `INSERT INTO tests (id, code, subject_id, title, duration_minutes, allowed_exits,
                            page_count, created_at)
         VALUES (1, 'K7M2QX', 1, 'Quiz', 30, 1, 1, 5000)`,
      ],
      'write',
    );

    expect(await runMigrations(database)).toEqual([3]);

    const { rows } = await database.execute('SELECT opens_at, closes_at FROM tests');
    expect(rows.map((row) => [row.opens_at, row.closes_at])).toEqual([[5000, null]]);
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
