import type { SchoolClass } from '@exam-room/shared';
import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { requireFirstRow } from '../../database/query-helpers.js';
import { compareNaturally } from '../../lib/text.js';
import type { ClassTreeRows } from './class-tree.js';

export type ClassContents = {
  studentCount: number;
  subjectCount: number;
};

export async function readClassTreeRows(database: Database): Promise<ClassTreeRows> {
  const [classRows, subjectRows, chapterRows] = await database.batch(
    [
      `SELECT classes.id, classes.name,
              (SELECT COUNT(*) FROM students WHERE students.class_id = classes.id) AS student_count
       FROM classes`,
      `SELECT subjects.id, subjects.class_id, subjects.name,
              (SELECT COUNT(*) FROM tests WHERE tests.subject_id = subjects.id) AS test_count
       FROM subjects`,
      `SELECT chapters.id, chapters.subject_id, chapters.name, chapters.position,
              (SELECT COUNT(*) FROM test_chapters
               WHERE test_chapters.chapter_id = chapters.id) AS test_count
       FROM chapters`,
    ],
    'read',
  );

  return {
    classes: (classRows?.rows ?? []).map((row) => ({
      ...toSchoolClass(row),
      studentCount: Number(row.student_count),
    })),
    subjects: (subjectRows?.rows ?? []).map((row) => ({
      id: Number(row.id),
      classId: Number(row.class_id),
      name: String(row.name),
      testCount: Number(row.test_count),
    })),
    chapters: (chapterRows?.rows ?? []).map((row) => ({
      id: Number(row.id),
      subjectId: Number(row.subject_id),
      name: String(row.name),
      position: Number(row.position),
      testCount: Number(row.test_count),
    })),
  };
}

export async function listClasses(database: Database): Promise<SchoolClass[]> {
  const { rows } = await database.execute('SELECT id, name FROM classes');
  return rows.map(toSchoolClass).sort((first, second) => compareNaturally(first.name, second.name));
}

export async function findClassById(
  database: Database,
  classId: number,
): Promise<SchoolClass | undefined> {
  const { rows } = await database.execute({
    sql: 'SELECT id, name FROM classes WHERE id = ?',
    args: [classId],
  });
  const [row] = rows;
  return row ? toSchoolClass(row) : undefined;
}

export async function insertClass(
  database: Database,
  name: string,
  createdAt: number,
): Promise<SchoolClass> {
  const result = await database.execute({
    sql: 'INSERT INTO classes (name, created_at) VALUES (?, ?) RETURNING id, name',
    args: [name, createdAt],
  });
  return toSchoolClass(requireFirstRow(result));
}

export async function renameClass(
  database: Database,
  classId: number,
  name: string,
): Promise<void> {
  await database.execute({
    sql: 'UPDATE classes SET name = ? WHERE id = ?',
    args: [name, classId],
  });
}

export async function countClassContents(
  database: Database,
  classId: number,
): Promise<ClassContents> {
  const result = await database.execute({
    sql: `SELECT (SELECT COUNT(*) FROM students WHERE class_id = ?) AS student_count,
                 (SELECT COUNT(*) FROM subjects WHERE class_id = ?) AS subject_count`,
    args: [classId, classId],
  });
  const row = requireFirstRow(result);
  return { studentCount: Number(row.student_count), subjectCount: Number(row.subject_count) };
}

export async function deleteClass(database: Database, classId: number): Promise<void> {
  await database.execute({ sql: 'DELETE FROM classes WHERE id = ?', args: [classId] });
}

function toSchoolClass(row: Row): SchoolClass {
  return { id: Number(row.id), name: String(row.name) };
}
