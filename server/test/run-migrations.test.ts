import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type Database } from '../src/database/connection.js';
import { migrations } from '../src/database/migrations.js';
import { runMigrations } from '../src/database/run-migrations.js';
import { IN_MEMORY_DATABASE_URL } from './support/test-context.js';

function migrationsUpTo(lastId: number) {
  return migrations.filter((migration) => migration.id <= lastId);
}

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
    await runMigrations(database, migrationsUpTo(1));
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

    expect(await runMigrations(database, migrationsUpTo(2))).toEqual([2]);

    const { rows } = await database.execute('SELECT version FROM attempts');
    expect(rows.map((row) => row.version)).toEqual([0]);
  });

  it('keeps tests made before migration 3 open from the time they were created', async () => {
    await runMigrations(database, migrationsUpTo(2));
    await database.batch(
      [
        "INSERT INTO subjects (id, name, created_at) VALUES (1, 'Physics', 0)",
        `INSERT INTO tests (id, code, subject_id, title, duration_minutes, allowed_exits,
                            page_count, created_at)
         VALUES (1, 'K7M2QX', 1, 'Quiz', 30, 1, 1, 5000)`,
      ],
      'write',
    );

    expect(await runMigrations(database, migrationsUpTo(3))).toEqual([3]);

    const { rows } = await database.execute('SELECT opens_at, closes_at FROM tests');
    expect(rows.map((row) => [row.opens_at, row.closes_at])).toEqual([[5000, null]]);
  });

  it('keeps every attempt and exit when migration 4 rebuilds the attempts table', async () => {
    await runMigrations(database, migrationsUpTo(3));
    await database.batch(
      [
        "INSERT INTO subjects (id, name, created_at) VALUES (1, 'Physics', 0)",
        `INSERT INTO tests (id, code, subject_id, title, duration_minutes, allowed_exits,
                            page_count, created_at, opens_at)
         VALUES (1, 'K7M2QX', 1, 'Quiz', 30, 1, 1, 0, 0)`,
        `INSERT INTO attempts (id, test_id, student_name, roll_no, roll_no_key, token_hash, status,
                               started_at, deadline_at, exit_count, version)
         VALUES (7, 1, 'Ayesha', '17', '17', 'hash', 'in_progress', 0, 1800000, 1, 3)`,
        `INSERT INTO exits (attempt_id, client_exit_id, reason, left_at, returned_at, away_ms)
         VALUES (7, 'exit-one-01', 'hidden', 1000, 4000, 3000)`,
      ],
      'write',
    );

    expect(await runMigrations(database, migrationsUpTo(4))).toEqual([4]);

    const attempts = await database.execute('SELECT id, exit_count, version FROM attempts');
    expect(attempts.rows.map((row) => [row.id, row.exit_count, row.version])).toEqual([[7, 1, 3]]);
    const exits = await database.execute('SELECT attempt_id, away_ms FROM exits');
    expect(exits.rows.map((row) => [row.attempt_id, row.away_ms])).toEqual([[7, 3000]]);
    const tests = await database.execute('SELECT leave_rule FROM tests');
    expect(tests.rows.map((row) => row.leave_rule)).toEqual(['lock']);

    await database.execute(
      "UPDATE attempts SET status = 'submitted', finish_reason = 'left_test' WHERE id = 7",
    );
    await database.execute('DELETE FROM attempts WHERE id = 7');
    const exitsAfterDelete = await database.execute('SELECT COUNT(*) AS total FROM exits');
    expect(exitsAfterDelete.rows[0]?.total).toBe(0);
  });

  it('puts existing subjects into "My class" and keeps every test, attempt and exit', async () => {
    await runMigrations(database, migrationsUpTo(4));
    await database.batch(
      [
        "INSERT INTO subjects (id, name, created_at) VALUES (3, 'Physics', 500), (4, 'Urdu', 900)",
        `INSERT INTO tests (id, code, subject_id, title, duration_minutes, allowed_exits,
                            page_count, created_at, opens_at)
         VALUES (1, 'K7M2QX', 3, 'Quiz', 30, 1, 1, 0, 0)`,
        `INSERT INTO test_pages (test_id, page_no, image, width, height)
         VALUES (1, 1, X'00', 10, 10)`,
        `INSERT INTO attempts (id, test_id, student_name, roll_no, roll_no_key, token_hash, status,
                               started_at, deadline_at)
         VALUES (7, 1, 'Ayesha', '17', '17', 'hash', 'in_progress', 0, 1800000)`,
        `INSERT INTO exits (attempt_id, client_exit_id, reason, left_at)
         VALUES (7, 'exit-one-01', 'hidden', 1000)`,
      ],
      'write',
    );

    expect(await runMigrations(database)).toEqual([5]);

    const classes = await database.execute('SELECT id, name, created_at FROM classes');
    expect(classes.rows.map((row) => [row.name, row.created_at])).toEqual([['My class', 500]]);
    const subjects = await database.execute('SELECT id, class_id, name FROM subjects ORDER BY id');
    expect(subjects.rows.map((row) => [row.id, row.class_id, row.name])).toEqual([
      [3, classes.rows[0]?.id, 'Physics'],
      [4, classes.rows[0]?.id, 'Urdu'],
    ]);
    const counts = await database.execute(
      `SELECT (SELECT COUNT(*) FROM tests) AS tests, (SELECT COUNT(*) FROM test_pages) AS pages,
              (SELECT COUNT(*) FROM attempts) AS attempts, (SELECT COUNT(*) FROM exits) AS exits,
              (SELECT kind FROM tests) AS kind`,
    );
    expect(counts.rows[0]).toMatchObject({
      tests: 1,
      pages: 1,
      attempts: 1,
      exits: 1,
      kind: 'test',
    });

    await expect(database.execute('DELETE FROM subjects WHERE id = 3')).rejects.toThrow(
      /FOREIGN KEY/,
    );
  });

  it('creates no class when there were no subjects yet', async () => {
    await runMigrations(database);
    const { rows } = await database.execute('SELECT COUNT(*) AS total FROM classes');
    expect(rows[0]?.total).toBe(0);
  });

  it('rolls back a table rebuild that would leave rows pointing nowhere', async () => {
    await runMigrations(database);
    await database.batch(
      [
        "INSERT INTO classes (id, name, created_at) VALUES (1, 'Class 9', 0)",
        "INSERT INTO subjects (id, class_id, name, created_at) VALUES (1, 1, 'Physics', 0)",
      ],
      'write',
    );
    const brokenRebuild = {
      id: 99,
      name: 'broken rebuild',
      rebuildsTables: true,
      statements: ['DELETE FROM classes'],
    };

    await expect(runMigrations(database, [brokenRebuild])).rejects.toThrow();

    const { rows } = await database.execute('SELECT COUNT(*) AS total FROM classes');
    expect(rows[0]?.total).toBe(1);
    const applied = await database.execute('SELECT id FROM schema_migrations WHERE id = 99');
    expect(applied.rows).toHaveLength(0);
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
