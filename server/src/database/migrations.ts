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
  {
    id: 7,
    name: 'fingerprint and face login with passkeys',
    statements: [
      `CREATE TABLE student_passkeys (
        id             INTEGER PRIMARY KEY,
        student_id     INTEGER NOT NULL REFERENCES students (id),
        credential_id  TEXT    NOT NULL UNIQUE,
        public_key     BLOB    NOT NULL,
        sign_count     INTEGER NOT NULL DEFAULT 0,
        transports     TEXT    NOT NULL DEFAULT '',
        created_at     INTEGER NOT NULL,
        last_used_at   INTEGER
      )`,
      `CREATE INDEX student_passkeys_student_id ON student_passkeys (student_id)`,
    ],
  },
  {
    id: 8,
    name: 'typed papers, answer keys and paper images',
    rebuildsTables: true,
    statements: [
      `CREATE TABLE tests_rebuilt (
        id                INTEGER PRIMARY KEY,
        code              TEXT    NOT NULL UNIQUE,
        subject_id        INTEGER NOT NULL REFERENCES subjects (id),
        kind              TEXT    NOT NULL DEFAULT 'test'
                          CHECK (kind IN ('test', 'quiz', 'assignment')),
        title             TEXT    NOT NULL,
        duration_minutes  INTEGER NOT NULL CHECK (duration_minutes >= 1),
        allowed_exits     INTEGER NOT NULL CHECK (allowed_exits BETWEEN 0 AND 2),
        leave_rule        TEXT    NOT NULL DEFAULT 'lock' CHECK (leave_rule IN ('lock', 'finish')),
        paper_kind        TEXT    NOT NULL DEFAULT 'pages' CHECK (paper_kind IN ('pages', 'typed')),
        page_count        INTEGER NOT NULL CHECK (page_count >= 0),
        paper             TEXT,
        answer_key        TEXT    NOT NULL DEFAULT '{}',
        question_count    INTEGER NOT NULL DEFAULT 0,
        max_marks         REAL,
        written_answers   TEXT    NOT NULL DEFAULT 'on_paper'
                          CHECK (written_answers IN ('on_paper', 'typed', 'photos',
                                                     'typed_and_photos')),
        created_at        INTEGER NOT NULL,
        opens_at          INTEGER,
        closes_at         INTEGER,
        CHECK (paper_kind = 'typed' OR page_count >= 1),
        CHECK (paper_kind = 'pages' OR paper IS NOT NULL)
      )`,
      `INSERT INTO tests_rebuilt
         (id, code, subject_id, kind, title, duration_minutes, allowed_exits, leave_rule,
          paper_kind, page_count, created_at, opens_at, closes_at)
       SELECT id, code, subject_id, kind, title, duration_minutes, allowed_exits, leave_rule,
              'pages', page_count, created_at, opens_at, closes_at
       FROM tests`,
      `DROP TABLE tests`,
      `ALTER TABLE tests_rebuilt RENAME TO tests`,
      `CREATE INDEX tests_subject_id ON tests (subject_id)`,
      `CREATE TABLE paper_images (
        id        INTEGER PRIMARY KEY,
        test_id   INTEGER NOT NULL REFERENCES tests (id) ON DELETE CASCADE,
        image_no  INTEGER NOT NULL CHECK (image_no >= 1),
        image     BLOB    NOT NULL,
        width     INTEGER NOT NULL,
        height    INTEGER NOT NULL,
        UNIQUE (test_id, image_no)
      )`,
    ],
  },
  {
    id: 9,
    name: 'answers saved from the phone',
    statements: [
      `CREATE TABLE answers (
        attempt_id   INTEGER NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
        question_id  TEXT    NOT NULL,
        choice       INTEGER,
        text         TEXT,
        sequence     INTEGER NOT NULL,
        answered_at  INTEGER NOT NULL,
        received_at  INTEGER NOT NULL,
        PRIMARY KEY (attempt_id, question_id)
      ) WITHOUT ROWID`,
    ],
  },
  {
    id: 10,
    name: 'photos of written answers',
    statements: [
      `CREATE TABLE answer_photos (
        id               INTEGER PRIMARY KEY,
        attempt_id       INTEGER NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
        photo_no         INTEGER NOT NULL CHECK (photo_no >= 1),
        client_photo_id  TEXT    NOT NULL,
        image            BLOB    NOT NULL,
        media_type       TEXT    NOT NULL,
        width            INTEGER NOT NULL,
        height           INTEGER NOT NULL,
        created_at       INTEGER NOT NULL,
        UNIQUE (attempt_id, photo_no),
        UNIQUE (attempt_id, client_photo_id)
      )`,
    ],
  },
  {
    id: 11,
    name: 'marks, comments and released results',
    statements: [
      `CREATE TABLE question_marks (
        attempt_id   INTEGER NOT NULL REFERENCES attempts (id) ON DELETE CASCADE,
        question_id  TEXT    NOT NULL,
        marks        REAL,
        comment      TEXT    NOT NULL DEFAULT '',
        PRIMARY KEY (attempt_id, question_id)
      ) WITHOUT ROWID`,
      `ALTER TABLE attempts ADD COLUMN mcq_marks REAL`,
      `ALTER TABLE attempts ADD COLUMN written_marks REAL`,
      `ALTER TABLE attempts ADD COLUMN total_marks REAL`,
      `ALTER TABLE attempts ADD COLUMN teacher_comment TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE tests ADD COLUMN results_released_at INTEGER`,
      `ALTER TABLE tests ADD COLUMN show_correct_answers INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE tests ADD COLUMN show_comments INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE tests ADD COLUMN show_top_scorer INTEGER NOT NULL DEFAULT 1`,
    ],
  },
];
