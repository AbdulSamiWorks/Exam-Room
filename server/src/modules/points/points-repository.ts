import type { ClassLeader, PointsEntry, StudentPoints } from '@exam-room/shared';
import type { Database } from '../../database/connection.js';
import { compareNaturally } from '../../lib/text.js';

export type NewPoints = {
  studentId: number;
  points: number;
  reason: string;
  createdAt: number;
};

export async function listClassPoints(
  database: Database,
  classId: number,
): Promise<StudentPoints[]> {
  const { rows } = await database.execute({
    sql: `SELECT students.id, students.name, students.roll_no,
                 COALESCE(SUM(points.points), 0) AS total
          FROM students
          LEFT JOIN points ON points.student_id = students.id
          WHERE students.class_id = ?
          GROUP BY students.id`,
    args: [classId],
  });
  return rows
    .map((row) => ({
      studentId: Number(row.id),
      name: String(row.name),
      rollNumber: String(row.roll_no),
      points: Number(row.total),
    }))
    .sort((first, second) => compareNaturally(first.rollNumber, second.rollNumber));
}

export async function listPointsOfStudent(
  database: Database,
  studentId: number,
): Promise<PointsEntry[]> {
  const { rows } = await database.execute({
    sql: `SELECT points.id, points.points, points.reason, points.created_at,
                 tests.title AS test_title
          FROM points LEFT JOIN tests ON tests.id = points.test_id
          WHERE points.student_id = ?
          ORDER BY points.created_at DESC, points.id DESC`,
    args: [studentId],
  });
  return rows.map((row) => ({
    id: Number(row.id),
    points: Number(row.points),
    reason: String(row.reason),
    testTitle: row.test_title === null ? null : String(row.test_title),
    createdAt: Number(row.created_at),
  }));
}

export async function addPoints(database: Database, entry: NewPoints): Promise<void> {
  await database.execute({
    sql: `INSERT INTO points (student_id, test_id, points, reason, created_at)
          VALUES (?, NULL, ?, ?, ?)`,
    args: [entry.studentId, entry.points, entry.reason, entry.createdAt],
  });
}

export async function replaceBountyPoints(
  database: Database,
  testId: number,
  winners: readonly NewPoints[],
): Promise<void> {
  await database.batch(
    [
      { sql: 'DELETE FROM points WHERE test_id = ?', args: [testId] },
      ...winners.map((winner) => ({
        sql: `INSERT INTO points (student_id, test_id, points, reason, created_at)
              VALUES (?, ?, ?, ?, ?)`,
        args: [winner.studentId, testId, winner.points, winner.reason, winner.createdAt],
      })),
    ],
    'write',
  );
}

export async function readPointsSummary(
  database: Database,
  classId: number,
  studentId: number,
): Promise<{ points: number; classLeaders: ClassLeader[] }> {
  const classPoints = await listClassPoints(database, classId);
  const best = Math.max(0, ...classPoints.map((entry) => entry.points));
  return {
    points: classPoints.find((entry) => entry.studentId === studentId)?.points ?? 0,
    classLeaders:
      best > 0
        ? classPoints
            .filter((entry) => entry.points === best)
            .map((entry) => ({ name: entry.name, points: entry.points }))
        : [],
  };
}
