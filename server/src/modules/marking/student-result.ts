import type {
  AnswerKey,
  MarkableUnit,
  Paper,
  QuestionAnswer,
  QuestionMark,
  StoredAnswer,
  UnitResult,
} from '@exam-room/shared';
import { checkUnit } from '@exam-room/shared/answer-checking';
import { checksAutomatically, markableUnitsOf, slotsOfUnit } from '@exam-room/shared/paper-rules';

export type ResultShowing = {
  isFinal: boolean;
  showCorrectAnswers: boolean;
  showComments: boolean;
};

export function unitResultsOf(
  paper: Paper,
  answerKey: AnswerKey,
  answers: ReadonlyMap<string, StoredAnswer>,
  questionMarks: Readonly<Record<string, QuestionMark>>,
  { isFinal, showCorrectAnswers, showComments }: ResultShowing,
): UnitResult[] {
  return markableUnitsOf(paper).map((unit) => {
    const key = answerKey[unit.id];
    const check = checkUnit(unit, key, answers);
    const showsMark = isFinal || check !== undefined;
    const teacherMark = showsMark ? questionMarks[unit.id] : undefined;
    const teacherMarks = teacherMark?.marks ?? null;
    const answer = answers.get(unit.id);
    return {
      unitId: unit.id,
      marks: teacherMarks ?? check?.marks ?? null,
      markedBy: teacherMarks !== null ? 'teacher' : check ? 'automatic' : null,
      chosenOption: answer?.choice ?? null,
      typedAnswer: answer?.text ?? null,
      blankAnswers: blankAnswersOf(unit, answers),
      isCorrect: check?.isCorrect ?? null,
      blankResults: check?.blankResults ?? [],
      correctOption: showCorrectAnswers ? (key?.option ?? null) : null,
      correctAnswers: showCorrectAnswers ? correctAnswersOf(unit, key) : [],
      modelAnswer: isFinal && showCorrectAnswers ? (key?.text ?? null) : null,
      comment: isFinal && showComments ? (teacherMark?.comment ?? '') : '',
    };
  });
}

export function automaticMaxMarksOf(paper: Paper, answerKey: AnswerKey): number {
  return markableUnitsOf(paper)
    .filter((unit) => checksAutomatically(unit, answerKey[unit.id]))
    .reduce((total, unit) => total + unit.marks, 0);
}

function blankAnswersOf(unit: MarkableUnit, answers: ReadonlyMap<string, StoredAnswer>): string[] {
  if (unit.kind !== 'blanks') return [];
  return slotsOfUnit(unit).map((slot) => answers.get(slot.slotId)?.text ?? '');
}

function correctAnswersOf(unit: MarkableUnit, key: QuestionAnswer | undefined): string[] {
  if (unit.kind === 'short') return key?.accepted ?? [];
  if (unit.kind === 'blanks') return (key?.blanks ?? []).map((accepted) => accepted[0] ?? '');
  return [];
}
