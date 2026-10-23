export type Migration = {
  id: number;
  name: string;
  statements: string[];
  rebuildsTables?: boolean;
};

export const migrations: readonly Migration[] = [
  {
    id: 1,
    name: 'initial schema',
    statements: [
      `CREATE TABLE subjects (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL COLLATE NOCASE UNIQUE,
        created_at  INTEGER NOT NULL
      )`,
      `CREATE TABLE tests (
        id                INTEGER PRIMARY KEY,
        code              TEXT    NOT NULL UNIQUE,
        subject_id        INTEGER NOT NULL REFERENCES subjects (id),
        title             TEXT    NOT NULL,
        duration_minutes  INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 600),
        allowed_exits     INTEGER NOT NULL CHECK (allowed_exits BETWEEN 0 AND 2),
        page_count        INTEGER NOT NULL CHECK (page_count >= 1),
        created_at        INTEGER NOT NULL
      )`,
      `CREATE INDEX tests_subject_id ON tests (subject_id)`,
      `CREATE TABLE test_pages (
        id       INTEGER PRIMARY KEY,
        test_id  INTEGER NOT NULL REFERENCES tests (id) ON DELETE CASCADE,
        page_no  INTEGER NOT NULL CHECK (page_no >= 1),
        image    BLOB    NOT NULL,
        width    INTEGER NOT NULL,
        height   INTEGER NOT NULL,
        UNIQUE (test_id, page_no)
      )`,
      `CREATE TABLE attempts (
        id              INTEGER PRIMARY KEY,
        test_id         INTEGER NOT NULL REFERENCES tests (id) ON DELETE CASCADE,
        student_name    TEXT    NOT NULL,
        roll_no         TEXT    NOT NULL,
        roll_no_key     TEXT    NOT NULL,
        token_hash      TEXT    NOT NULL UNIQUE,
        status          TEXT    NOT NULL CHECK (status IN ('in_progress', 'submitted', 'locked')),
        finish_reason   TEXT    CHECK (finish_reason IN ('student', 'time_up')),
        started_at      INTEGER NOT NULL,
        deadline_at     INTEGER NOT NULL,
        finished_at     INTEGER,
        exit_count      INTEGER NOT NULL DEFAULT 0,
        forgiven_exits  INTEGER NOT NULL DEFAULT 0,
        UNIQUE (test_id, roll_no_key)
      )`,
      `CREATE TABLE exits (
        id              INTEGER PRIMARY KEY,
        attempt_id      INTEGER NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
        client_exit_id  TEXT    NOT NULL,
        reason          TEXT    NOT NULL
                        CHECK (reason IN ('hidden', 'blur', 'fullscreen', 'device_change')),
        left_at         INTEGER NOT NULL,
        returned_at     INTEGER,
        away_ms         INTEGER,
        UNIQUE (attempt_id, client_exit_id)
      )`,
    ],
  },
  {
    id: 2,
    name: 'attempt version for safe concurrent updates',
    statements: [`ALTER TABLE attempts ADD COLUMN version INTEGER NOT NULL DEFAULT 0`],
  },
  {
    id: 3,
    name: 'test opening and closing times',
    statements: [
      `ALTER TABLE tests ADD COLUMN opens_at INTEGER`,
      `ALTER TABLE tests ADD COLUMN closes_at INTEGER`,
      `UPDATE tests SET opens_at = created_at`,
    ],
  },
  {
    id: 4,
    name: 'teacher and leave finish reasons, waiting status and leave rule',
    statements: [
      `CREATE TABLE attempts_rebuilt (
        id              INTEGER PRIMARY KEY,
        test_id         INTEGER NOT NULL REFERENCES tests (id) ON DELETE CASCADE,
        student_name    TEXT    NOT NULL,
        roll_no         TEXT    NOT NULL,
        roll_no_key     TEXT    NOT NULL,
        token_hash      TEXT    NOT NULL UNIQUE,
        status          TEXT    NOT NULL
                        CHECK (status IN ('waiting', 'in_progress', 'submitted', 'locked')),
        finish_reason   TEXT
                        CHECK (finish_reason IN ('student', 'time_up', 'teacher', 'left_test')),
        started_at      INTEGER NOT NULL,
        deadline_at     INTEGER NOT NULL,
        finished_at     INTEGER,
        exit_count      INTEGER NOT NULL DEFAULT 0,
        forgiven_exits  INTEGER NOT NULL DEFAULT 0,
        version         INTEGER NOT NULL DEFAULT 0,
        UNIQUE (test_id, roll_no_key)
      )`,
      `INSERT INTO attempts_rebuilt
         (id, test_id, student_name, roll_no, roll_no_key, token_hash, status, finish_reason,
          started_at, deadline_at, finished_at, exit_count, forgiven_exits, version)
       SELECT id, test_id, student_name, roll_no, roll_no_key, token_hash, status, finish_reason,
              started_at, deadline_at, finished_at, exit_count, forgiven_exits, version
       FROM attempts`,
      `CREATE TABLE exits_backup AS
         SELECT id, attempt_id, client_exit_id, reason, left_at, returned_at, away_ms FROM exits`,
      `DROP TABLE exits`,
      `DROP TABLE attempts`,
      `ALTER TABLE attempts_rebuilt RENAME TO attempts`,
      `CREATE TABLE exits (
        id              INTEGER PRIMARY KEY,
        attempt_id      INTEGER NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
        client_exit_id  TEXT    NOT NULL,
        reason          TEXT    NOT NULL
                        CHECK (reason IN ('hidden', 'blur', 'fullscreen', 'device_change')),
        left_at         INTEGER NOT NULL,
        returned_at     INTEGER,
        away_ms         INTEGER,
        UNIQUE (attempt_id, client_exit_id)
      )`,
      `INSERT INTO exits (id, attempt_id, client_exit_id, reason, left_at, returned_at, away_ms)
       SELECT id, attempt_id, client_exit_id, reason, left_at, returned_at, away_ms
       FROM exits_backup`,
      `DROP TABLE exits_backup`,
      `ALTER TABLE tests ADD COLUMN leave_rule TEXT NOT NULL DEFAULT 'lock'
         CHECK (leave_rule IN ('lock', 'finish'))`,
    ],
  },
  {
    id: 5,
    name: 'classes, subjects per class, chapters, students and test types',
    rebuildsTables: true,
    statements: [
      `CREATE TABLE classes (
        id          INTEGER PRIMARY KEY,
        name        TEXT    NOT NULL COLLATE NOCASE UNIQUE,
        created_at  INTEGER NOT NULL
      )`,
      `INSERT INTO classes (name, created_at)
       SELECT 'My class', created_at FROM subjects ORDER BY created_at LIMIT 1`,
      `CREATE TABLE subjects_rebuilt (
        id          INTEGER PRIMARY KEY,
        class_id    INTEGER NOT NULL REFERENCES classes (id),
        name        TEXT    NOT NULL COLLATE NOCASE,
        created_at  INTEGER NOT NULL,
        UNIQUE (class_id, name)
      )`,
      `INSERT INTO subjects_rebuilt (id, class_id, name, created_at)
       SELECT id, (SELECT MIN(id) FROM classes), name, created_at FROM subjects`,
      `DROP TABLE subjects`,
      `ALTER TABLE subjects_rebuilt RENAME TO subjects`,
      `CREATE TABLE chapters (
        id          INTEGER PRIMARY KEY,
        subject_id  INTEGER NOT NULL REFERENCES subjects (id),
        name        TEXT    NOT NULL COLLATE NOCASE,
        position    INTEGER NOT NULL,
        created_at  INTEGER NOT NULL,
        UNIQUE (subject_id, name)
      )`,
      `CREATE TABLE students (
        id               INTEGER PRIMARY KEY,
        class_id         INTEGER NOT NULL REFERENCES classes (id),
        name             TEXT    NOT NULL,
        roll_no          TEXT    NOT NULL,
        roll_no_key      TEXT    NOT NULL,
        pin_hash         TEXT    NOT NULL,
        session_version  INTEGER NOT NULL DEFAULT 0,
        created_at       INTEGER NOT NULL,
        UNIQUE (class_id, roll_no_key)
      )`,
      `ALTER TABLE tests ADD COLUMN kind TEXT NOT NULL DEFAULT 'test'
         CHECK (kind IN ('test', 'quiz', 'assignment'))`,
      `CREATE TABLE test_chapters (
        test_id     INTEGER NOT NULL REFERENCES tests (id) ON DELETE CASCADE,
        chapter_id  INTEGER NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
        PRIMARY KEY (test_id, chapter_id)
      ) WITHOUT ROWID`,
      `CREATE INDEX test_chapters_chapter_id ON test_chapters (chapter_id)`,
    ],
  },
  {
    id: 6,
    name: 'attempts belong to student accounts',
    rebuildsTables: true,
    statements: [
      `CREATE TABLE attempts_rebuilt (
        id              INTEGER PRIMARY KEY,
        test_id         INTEGER NOT NULL REFERENCES tests (id) ON DELETE CASCADE,
        student_id      INTEGER REFERENCES students (id),
        student_name    TEXT    NOT NULL,
        roll_no         TEXT    NOT NULL,
        roll_no_key     TEXT    NOT NULL,
        token_hash      TEXT    UNIQUE,
        status          TEXT    NOT NULL
                        CHECK (status IN ('waiting', 'in_progress', 'submitted', 'locked')),
        finish_reason   TEXT
                        CHECK (finish_reason IN ('student', 'time_up', 'teacher', 'left_test')),
        started_at      INTEGER NOT NULL,
        deadline_at     INTEGER NOT NULL,
        finished_at     INTEGER,
        exit_count      INTEGER NOT NULL DEFAULT 0,
        forgiven_exits  INTEGER NOT NULL DEFAULT 0,
        version         INTEGER NOT NULL DEFAULT 0,
        UNIQUE (test_id, student_id)
      )`,
      `INSERT INTO attempts_rebuilt
         (id, test_id, student_id, student_name, roll_no, roll_no_key, token_hash, status,
          finish_reason, started_at, deadline_at, finished_at, exit_count, forgiven_exits, version)
       SELECT id, test_id, NULL, student_name, roll_no, roll_no_key, token_hash, status,
              finish_reason, started_at, deadline_at, finished_at, exit_count, forgiven_exits,
              version
       FROM attempts`,
      `DROP TABLE attempts`,
      `ALTER TABLE attempts_rebuilt RENAME TO attempts`,
      `CREATE INDEX attempts_student_id ON attempts (student_id)`,
    ],
  },
];
