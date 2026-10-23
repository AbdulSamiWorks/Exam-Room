import type { NewStudent, Student } from '@exam-room/shared';
import type { Row } from '@libsql/client';
import type { Database } from '../../database/connection.js';
import { placeholdersFor } from '../../database/query-helpers.js';
import { compareNaturally, comparisonKey } from '../../lib/text.js';

export type StudentToInsert = NewStudent & {
  pinHash: string;
};

const STUDENT_COLUMNS = 'id, class_id, name, roll_no';

export async function listStudentsOfClass(database: Database, classId: number): Promise<Student[]> {
  const { rows } = await database.execute({
    sql: `SELECT ${STUDENT_COLUMNS} FROM students WHERE class_id = ?`,
    args: [classId],
  });
  return rows.map(toStudent).sort(byRollNumber);
}

export async function findStudentById(
  database: Database,
  studentId: number,
): Promise<Student | undefined> {
  const { rows } = await database.execute({
    sql: `SELECT ${STUDENT_COLUMNS} FROM students WHERE id = ?`,
    args: [studentId],
  });
  const [row] = rows;
  return row ? toStudent(row) : undefined;
}

export async function findTakenRollNumbers(
  database: Database,
  classId: number,
  rollNumbers: readonly string[],
): Promise<string[]> {
  if (rollNumbers.length === 0) return [];
  const rollNumberKeys = rollNumbers.map(comparisonKey);
  const { rows } = await database.execute({
    sql: `SELECT roll_no FROM students
          WHERE class_id = ? AND roll_no_key IN (${placeholdersFor(rollNumberKeys)})`,
    args: [classId, ...rollNumberKeys],
  });
  return rows.map((row) => String(row.roll_no)).sort(compareNaturally);
}

export async function insertStudents(
  database: Database,
  classId: number,
  students: readonly StudentToInsert[],
  createdAt: number,
): Promise<Student[]> {
  const results = await database.batch(
    students.map((student) => ({
      sql: `INSERT INTO students (class_id, name, roll_no, roll_no_key, pin_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            RETURNING ${STUDENT_COLUMNS}`,
      args: [
        classId,
        student.name,
        student.rollNumber,
        comparisonKey(student.rollNumber),
        student.pinHash,
        createdAt,
      ],
    })),
    'write',
  );
  return results.flatMap((result) => result.rows.map(toStudent));
}

export async function saveStudent(database: Database, student: Student): Promise<void> {
  await database.execute({
    sql: 'UPDATE students SET class_id = ?, name = ?, roll_no = ?, roll_no_key = ? WHERE id = ?',
    args: [
      student.classId,
      student.name,
      student.rollNumber,
      comparisonKey(student.rollNumber),
      student.id,
    ],
  });
}

export async function replacePinHash(
  database: Database,
  studentId: number,
  pinHash: string,
): Promise<void> {
  await database.execute({
    sql: `UPDATE students SET pin_hash = ?, session_version = session_version + 1
          WHERE id = ?`,
    args: [pinHash, studentId],
  });
}

export async function moveStudentsOfClass(
  database: Database,
  fromClassId: number,
  toClassId: number,
): Promise<number> {
  const result = await database.execute({
    sql: 'UPDATE students SET class_id = ? WHERE class_id = ?',
    args: [toClassId, fromClassId],
  });
  return result.rowsAffected;
}

export async function deleteStudent(database: Database, studentId: number): Promise<void> {
  await database.execute({ sql: 'DELETE FROM students WHERE id = ?', args: [studentId] });
}

function byRollNumber(first: Student, second: Student): number {
  return compareNaturally(first.rollNumber, second.rollNumber);
}

function toStudent(row: Row): Student {
  return {
    id: Number(row.id),
    classId: Number(row.class_id),
    name: String(row.name),
    rollNumber: String(row.roll_no),
  };
}
