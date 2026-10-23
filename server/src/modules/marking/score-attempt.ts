import type { AnswerKey, AttemptScore, Paper, QuestionMark, StoredAnswer } from '@exam-room/shared';
import { questionsOf } from '@exam-room/shared/paper-rules';

export function scoreAttempt(
  paper: Paper | null,
  answerKey: AnswerKey,
  answers: ReadonlyMap<string, StoredAnswer>,
  questionMarks: ReadonlyMap<string, QuestionMark>,
): AttemptScore {
  const score: AttemptScore = {
    mcqMarks: 0,
    writtenMarks: 0,
    totalMarks: 0,
    correctCount: 0,
    mcqCount: 0,
    markedWrittenCount: 0,
    writtenCount: 0,
  };
  if (!paper) return score;

  for (const question of questionsOf(paper)) {
    const teacherMarks = questionMarks.get(question.id)?.marks ?? null;
    if (question.kind === 'mcq') {
      score.mcqCount += 1;
      const correctOption = answerKey[question.id]?.option;
      const isCorrect =
        correctOption !== undefined && answers.get(question.id)?.choice === correctOption;
      if (isCorrect) score.correctCount += 1;
      score.mcqMarks += teacherMarks ?? (isCorrect ? question.marks : 0);
    } else {
      score.writtenCount += 1;
      if (teacherMarks !== null) {
        score.markedWrittenCount += 1;
        score.writtenMarks += teacherMarks;
      }
    }
  }
  score.totalMarks = score.mcqMarks + score.writtenMarks;
  return score;
}

export function topScorerNames(
  totals: ReadonlyArray<{ studentName: string; totalMarks: number | null }>,
): string[] {
  const scored = totals.filter(
    (entry): entry is { studentName: string; totalMarks: number } => entry.totalMarks !== null,
  );
  if (scored.length === 0) return [];
  const best = Math.max(...scored.map((entry) => entry.totalMarks));
  if (best <= 0) return [];
  return scored.filter((entry) => entry.totalMarks === best).map((entry) => entry.studentName);
}

export function marksProblem(
  paper: Paper,
  questionMarks: Readonly<Record<string, QuestionMark>>,
): string | undefined {
  const questionsById = new Map(questionsOf(paper).map((question) => [question.id, question]));
  for (const [questionId, mark] of Object.entries(questionMarks)) {
    const question = questionsById.get(questionId);
    if (!question) return 'A mark names a question that is not on the paper.';
    if (mark.marks !== null && (mark.marks < 0 || mark.marks > question.marks)) {
      return `Marks must be between 0 and ${question.marks} for this question.`;
    }
  }
  return undefined;
}
