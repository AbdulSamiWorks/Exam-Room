import type { StudentResultResponse } from '@exam-room/shared';
import { questionsOf } from '@exam-room/shared/paper-rules';

export type MultipleChoiceSummary = {
  right: number;
  wrong: number;
  unanswered: number;
};

export function multipleChoiceSummary(
  result: Pick<StudentResultResponse, 'paper' | 'questions'>,
): MultipleChoiceSummary {
  const multipleChoiceIds = new Set(
    (result.paper ? questionsOf(result.paper) : [])
      .filter((question) => question.kind === 'mcq')
      .map((question) => question.id),
  );
  const summary: MultipleChoiceSummary = { right: 0, wrong: 0, unanswered: 0 };
  for (const question of result.questions) {
    if (!multipleChoiceIds.has(question.questionId)) continue;
    if (question.chosenOption === null) summary.unanswered += 1;
    else if ((question.marks ?? 0) > 0) summary.right += 1;
    else summary.wrong += 1;
  }
  return summary;
}
