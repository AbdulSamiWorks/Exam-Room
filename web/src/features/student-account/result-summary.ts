import type { StudentResultResponse, UnitResult } from '@exam-room/shared';
import { markableUnitsOf } from '@exam-room/shared/paper-rules';

export type AnswerSummary = {
  right: number;
  wrong: number;
  unanswered: number;
};

export function automaticSummary(units: readonly UnitResult[]): AnswerSummary {
  const summary: AnswerSummary = { right: 0, wrong: 0, unanswered: 0 };
  for (const unit of units) {
    if (unit.isCorrect === null) continue;
    if (!hasAnswer(unit)) summary.unanswered += 1;
    else if (isRight(unit)) summary.right += 1;
    else summary.wrong += 1;
  }
  return summary;
}

function hasAnswer(unit: UnitResult): boolean {
  return (
    unit.chosenOption !== null ||
    Boolean(unit.typedAnswer?.trim()) ||
    unit.blankAnswers.some((answer) => answer.trim() !== '')
  );
}

function isRight(unit: UnitResult): boolean {
  return unit.isCorrect === true || (unit.markedBy === 'teacher' && (unit.marks ?? 0) > 0);
}

export function checksOnlyMultipleChoice(
  result: Pick<StudentResultResponse, 'paper' | 'units'>,
): boolean {
  const kindsById = new Map(
    (result.paper ? markableUnitsOf(result.paper) : []).map((unit) => [unit.id, unit.kind]),
  );
  return result.units
    .filter((unit) => unit.isCorrect !== null)
    .every((unit) => kindsById.get(unit.unitId) === 'mcq');
}
