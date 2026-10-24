import type {
  ChapterTag,
  ProgressResponse,
  ProgressResult,
  ProgressSubject,
  StudentProfile,
  TestKind,
} from '@exam-room/shared';
import type { Database } from '../../database/connection.js';
import { chapterTagsByTestId } from '../tests/test-chapters-repository.js';

export async function readProgress(
  database: Database,
  student: StudentProfile,
  onlyReleased: boolean,
): Promise<ProgressResponse> {
  const releasedFilter = onlyReleased ? 'AND tests.results_released_at IS NOT NULL' : '';
  const [resultRows, tagRows, subjectRows, chapterRows] = await database.batch(
    [
      {
        sql: `SELECT tests.id, tests.code, tests.title, tests.kind, tests.max_marks,
                     tests.results_released_at, subjects.id AS subject_id,
                     subjects.name AS subject_name, attempts.total_marks,
                     COALESCE(attempts.finished_at, attempts.started_at) AS date
              FROM attempts
              JOIN tests ON tests.id = attempts.test_id
              JOIN subjects ON subjects.id = tests.subject_id
              WHERE attempts.student_id = ? AND attempts.total_marks IS NOT NULL
                AND tests.max_marks > 0 ${releasedFilter}
              ORDER BY date`,
        args: [student.id],
      },
      {
        sql: `SELECT test_chapters.test_id, chapters.id, chapters.name
              FROM test_chapters
              JOIN chapters ON chapters.id = test_chapters.chapter_id
              WHERE test_chapters.test_id IN
                (SELECT test_id FROM attempts WHERE student_id = ?)
              ORDER BY chapters.position, chapters.id`,
        args: [student.id],
      },
      {
        sql: 'SELECT id, name FROM subjects WHERE class_id = ? ORDER BY name',
        args: [student.schoolClass.id],
      },
      {
        sql: `SELECT chapters.id, chapters.name, chapters.subject_id
              FROM chapters JOIN subjects ON subjects.id = chapters.subject_id
              WHERE subjects.class_id = ?
              ORDER BY chapters.position, chapters.id`,
        args: [student.schoolClass.id],
      },
    ],
    'read',
  );

  const tagsByTestId = chapterTagsByTestId(tagRows?.rows ?? []);
  const results: ProgressResult[] = (resultRows?.rows ?? []).map((row) => ({
    testCode: String(row.code),
    testTitle: String(row.title),
    kind: String(row.kind) as TestKind,
    subjectId: Number(row.subject_id),
    subjectName: String(row.subject_name),
    chapters: tagsByTestId.get(Number(row.id)) ?? [],
    date: Number(row.date),
    marks: Number(row.total_marks),
    maxMarks: Number(row.max_marks),
    isReleased: row.results_released_at !== null,
  }));

  const chaptersBySubjectId = new Map<number, ChapterTag[]>();
  for (const row of chapterRows?.rows ?? []) {
    const subjectId = Number(row.subject_id);
    const chapters = chaptersBySubjectId.get(subjectId) ?? [];
    chapters.push({ id: Number(row.id), name: String(row.name) });
    chaptersBySubjectId.set(subjectId, chapters);
  }
  const subjects: ProgressSubject[] = (subjectRows?.rows ?? []).map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    chapters: chaptersBySubjectId.get(Number(row.id)) ?? [],
  }));

  return { student, subjects, results };
}
