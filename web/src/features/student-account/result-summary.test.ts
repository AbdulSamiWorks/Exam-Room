import type { Paper, UnitResult } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import { automaticSummary, checksOnlyMultipleChoice } from './result-summary';

const paper: Paper = {
  instructions: '',
  sections: [
    {
      title: '',
      instructions: '',
      questions: [
        { id: 'q1', kind: 'mcq', text: 'A', marks: 1, options: ['x', 'y'], imageNumber: null },
        { id: 'q2', kind: 'short', text: 'B', marks: 1, options: [], imageNumber: null },
        { id: 'q3', kind: 'blanks', text: 'C ___ ___', marks: 1, options: [], imageNumber: null },
        { id: 'q4', kind: 'written', text: 'D', marks: 3, options: [], imageNumber: null },
      ],
    },
  ],
};

function unit(unitId: string, changes: Partial<UnitResult>): UnitResult {
  return {
    unitId,
    marks: 0,
    markedBy: 'automatic',
    chosenOption: null,
    typedAnswer: null,
    blankAnswers: [],
    isCorrect: false,
    blankResults: [],
    correctOption: null,
    correctAnswers: [],
    modelAnswer: null,
    comment: '',
    ...changes,
  };
}

describe('automaticSummary', () => {
  it('counts right, wrong and unanswered answers the app checks', () => {
    expect(
      automaticSummary([
        unit('q1', { chosenOption: 1, isCorrect: true, marks: 1 }),
        unit('q2', { typedAnswer: 'He go.' }),
        unit('q3', { blankAnswers: ['', ' '] }),
        unit('q4', { typedAnswer: 'Long answer', isCorrect: null, marks: null, markedBy: null }),
      ]),
    ).toEqual({ right: 1, wrong: 1, unanswered: 1 });
  });

  it('counts an answer the teacher gave marks to as right', () => {
    expect(
      automaticSummary([unit('q2', { typedAnswer: 'He goes', marks: 1, markedBy: 'teacher' })]),
    ).toEqual({ right: 1, wrong: 0, unanswered: 0 });
  });
});

describe('checksOnlyMultipleChoice', () => {
  it('tells a multiple choice result from one with typed answers', () => {
    const multipleChoice = [unit('q1', { isCorrect: true }), unit('q4', { isCorrect: null })];
    expect(checksOnlyMultipleChoice({ paper, units: multipleChoice })).toBe(true);
    expect(checksOnlyMultipleChoice({ paper, units: [...multipleChoice, unit('q2', {})] })).toBe(
      false,
    );
  });
});
