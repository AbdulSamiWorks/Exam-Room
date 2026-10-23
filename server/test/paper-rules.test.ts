import {
  answerKeyProblems,
  keepAnswersOfPaper,
  maxMarksOf,
  numberQuestions,
  optionIndexOf,
  optionLetter,
  paperSchema,
} from '@exam-room/shared/paper-rules';
import { describe, expect, it } from 'vitest';
import { SAMPLE_PAPER } from './support/paper-fixtures.js';

describe('paper rules', () => {
  it('numbers questions across sections and adds up the marks', () => {
    expect(numberQuestions(SAMPLE_PAPER).map((question) => [question.id, question.number])).toEqual(
      [
        ['q1', 1],
        ['q2', 2],
        ['q3', 3],
      ],
    );
    expect(maxMarksOf(SAMPLE_PAPER)).toBe(5);
  });

  it('explains answer keys that do not fit the paper', () => {
    expect(answerKeyProblems(SAMPLE_PAPER, { q2: { option: 2 } })).toEqual([]);
    expect(answerKeyProblems(SAMPLE_PAPER, { q2: { option: 3 } })).toEqual([
      'Question 2 has no option D.',
    ]);
    expect(answerKeyProblems(SAMPLE_PAPER, { q9: { option: 0 } })).toHaveLength(1);
  });

  it('keeps only the answers that still fit a changed paper', () => {
    expect(
      keepAnswersOfPaper(SAMPLE_PAPER, { q1: { option: 1 }, q2: { option: 5 }, q7: { option: 0 } }),
    ).toEqual({ q1: { option: 1 } });
  });

  it('checks options, marks and ids', () => {
    const question = SAMPLE_PAPER.sections[0]!.questions[0]!;
    const paperWith = (changes: object) => ({
      ...SAMPLE_PAPER,
      sections: [{ title: '', instructions: '', questions: [{ ...question, ...changes }] }],
    });
    expect(paperSchema.safeParse(SAMPLE_PAPER).success).toBe(true);
    expect(paperSchema.safeParse(paperWith({ options: ['Only one'] })).success).toBe(false);
    expect(paperSchema.safeParse(paperWith({ marks: 0.25 })).success).toBe(false);
    expect(paperSchema.safeParse(paperWith({ kind: 'written' })).success).toBe(false);
    expect(paperSchema.safeParse(paperWith({ id: 'question-1' })).success).toBe(false);
  });

  it('turns option letters into positions and back', () => {
    expect(optionLetter(1)).toBe('B');
    expect(optionIndexOf(' c ')).toBe(2);
    expect(optionIndexOf('z')).toBeUndefined();
  });
});
