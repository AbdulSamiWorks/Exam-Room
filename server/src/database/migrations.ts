export type Migration = {
  id: number;
  name: string;
  statements: string[];
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
];
