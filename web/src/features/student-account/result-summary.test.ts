import type { Paper, QuestionResult } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import { multipleChoiceSummary } from './result-summary';

const paper: Paper = {
  instructions: '',
  sections: [
    {
      title: '',
      instructions: '',
      questions: [
        { id: 'q1', kind: 'mcq', text: 'A', marks: 1, options: ['x', 'y'], imageNumber: null },
        { id: 'q2', kind: 'mcq', text: 'B', marks: 1, options: ['x', 'y'], imageNumber: null },
        { id: 'q3', kind: 'mcq', text: 'C', marks: 1, options: ['x', 'y'], imageNumber: null },
        { id: 'q4', kind: 'written', text: 'D', marks: 3, options: [], imageNumber: null },
      ],
    },
  ],
};

function result(questionId: string, chosenOption: number | null, marks: number | null) {
  return {
    questionId,
    marks,
    chosenOption,
    typedAnswer: null,
    correctOption: null,
    modelAnswer: null,
    comment: '',
  } satisfies QuestionResult;
}

describe('multipleChoiceSummary', () => {
  it('counts right, wrong and unanswered multiple choice questions only', () => {
    expect(
      multipleChoiceSummary({
        paper,
        questions: [
          result('q1', 1, 1),
          result('q2', 0, 0),
          result('q3', null, 0),
          result('q4', null, 3),
        ],
      }),
    ).toEqual({ right: 1, wrong: 1, unanswered: 1 });
  });
});
