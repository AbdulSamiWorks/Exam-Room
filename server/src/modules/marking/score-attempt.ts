import type { AnswerKey, AttemptScore, Paper, QuestionMark, StoredAnswer } from '@exam-room/shared';
import { checkUnit } from '@exam-room/shared/answer-checking';
import { markableUnitsOf } from '@exam-room/shared/paper-rules';

export function scoreAttempt(
  paper: Paper | null,
  answerKey: AnswerKey,
  answers: ReadonlyMap<string, StoredAnswer>,
  questionMarks: ReadonlyMap<string, QuestionMark>,
): AttemptScore {
  const score: AttemptScore = {
    autoMarks: 0,
    writtenMarks: 0,
    totalMarks: 0,
    correctCount: 0,
    autoCount: 0,
    markedWrittenCount: 0,
    writtenCount: 0,
  };
  if (!paper) return score;

  for (const unit of markableUnitsOf(paper)) {
    const teacherMarks = questionMarks.get(unit.id)?.marks ?? null;
    const check = checkUnit(unit, answerKey[unit.id], answers);
    if (check) {
      score.autoCount += 1;
      if (check.isCorrect) score.correctCount += 1;
      score.autoMarks += teacherMarks ?? check.marks;
    } else {
      score.writtenCount += 1;
      if (teacherMarks !== null) {
        score.markedWrittenCount += 1;
        score.writtenMarks += teacherMarks;
      }
    }
  }
  score.autoMarks = roundMarks(score.autoMarks);
  score.writtenMarks = roundMarks(score.writtenMarks);
  score.totalMarks = roundMarks(score.autoMarks + score.writtenMarks);
  return score;
}

const MARKS_PRECISION = 100;

function roundMarks(marks: number): number {
  return Math.round(marks * MARKS_PRECISION) / MARKS_PRECISION;
}

export function topScorers<Entry extends { totalMarks: number | null }>(
  entries: readonly Entry[],
): Entry[] {
  const best = Math.max(0, ...entries.map((entry) => entry.totalMarks ?? 0));
  if (best <= 0) return [];
  return entries.filter((entry) => entry.totalMarks === best);
}

export function topScorerNames(
  entries: ReadonlyArray<{ studentName: string; totalMarks: number | null }>,
): string[] {
  return topScorers(entries).map((entry) => entry.studentName);
}

export function marksProblem(
  paper: Paper,
  questionMarks: Readonly<Record<string, QuestionMark>>,
): string | undefined {
  const unitsById = new Map(markableUnitsOf(paper).map((unit) => [unit.id, unit]));
  for (const [unitId, mark] of Object.entries(questionMarks)) {
    const unit = unitsById.get(unitId);
    if (!unit) return 'A mark names a question that is not on the paper.';
    if (mark.marks !== null && (mark.marks < 0 || mark.marks > unit.marks)) {
      return `Marks must be between 0 and ${unit.marks} for question ${unit.label}.`;
    }
  }
  return undefined;
}
