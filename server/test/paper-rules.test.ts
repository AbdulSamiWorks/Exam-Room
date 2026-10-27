import {
  answerKeyProblems,
  answerKeySchema,
  answerSlotsOf,
  blankCountOf,
  checksAutomatically,
  keepAnswersOfPaper,
  markableUnitsOf,
  maxMarksOf,
  numberQuestions,
  optionIndexOf,
  optionLetter,
  paperSchema,
  unitIdOfSlot,
} from '@exam-room/shared/paper-rules';
import { describe, expect, it } from 'vitest';
import { GRAMMAR_ANSWER_KEY, GRAMMAR_PAPER, SAMPLE_PAPER } from './support/paper-fixtures.js';

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

describe('questions with parts and blanks', () => {
  const units = markableUnitsOf(GRAMMAR_PAPER);

  it('marks each part and each question without parts as one unit', () => {
    expect(units.map((unit) => [unit.id, unit.label, unit.marks])).toEqual([
      ['q1', '1', 1],
      ['q2a', '2(a)', 1],
      ['q2b', '2(b)', 1],
      ['q3', '3', 1],
      ['q4', '4', 5],
    ]);
    expect(maxMarksOf(GRAMMAR_PAPER)).toBe(9);
  });

  it('gives every blank its own answer slot', () => {
    expect([...answerSlotsOf(GRAMMAR_PAPER).keys()]).toEqual([
      'q1',
      'q2a',
      'q2b',
      'q3.1',
      'q3.2',
      'q4',
    ]);
    expect(unitIdOfSlot('q3.2')).toBe('q3');
    expect(blankCountOf('a _____ b ___ c __')).toBe(2);
  });

  it('knows which units the app checks by itself', () => {
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    const unit = (id: string) => byId.get(id)!;
    expect(checksAutomatically(unit('q1'), undefined)).toBe(true);
    expect(checksAutomatically(unit('q2a'), GRAMMAR_ANSWER_KEY.q2a)).toBe(true);
    expect(checksAutomatically(unit('q2a'), undefined)).toBe(false);
    expect(checksAutomatically(unit('q3'), { blanks: [['lives']] })).toBe(false);
    expect(checksAutomatically(unit('q3'), GRAMMAR_ANSWER_KEY.q3)).toBe(true);
    expect(checksAutomatically(unit('q4'), GRAMMAR_ANSWER_KEY.q4)).toBe(false);
  });

  it('accepts the paper and its key, and explains keys that do not fit', () => {
    expect(paperSchema.safeParse(GRAMMAR_PAPER).success).toBe(true);
    expect(answerKeySchema.safeParse(GRAMMAR_ANSWER_KEY).success).toBe(true);
    expect(answerKeyProblems(GRAMMAR_PAPER, GRAMMAR_ANSWER_KEY)).toEqual([]);
    expect(answerKeyProblems(GRAMMAR_PAPER, { q3: { blanks: [['lives']] } })).toEqual([
      'Question 3 has 2 blanks but the key gives 1 answers.',
    ]);
    expect(answerKeyProblems(GRAMMAR_PAPER, { q4: { accepted: ['x'] } })).toEqual([
      'Question 4 does not take a short answer.',
    ]);
    expect(
      keepAnswersOfPaper(GRAMMAR_PAPER, { q2b: { accepted: ['x'] }, q2c: { accepted: ['y'] } }),
    ).toEqual({
      q2b: { accepted: ['x'] },
    });
  });

  it('checks parts, marks and blanks', () => {
    const [section] = GRAMMAR_PAPER.sections;
    const withQuestion = (index: number, changes: object) => ({
      ...GRAMMAR_PAPER,
      sections: [
        {
          ...section!,
          questions: section!.questions.map((question, questionIndex) =>
            questionIndex === index ? { ...question, ...changes } : question,
          ),
        },
      ],
    });
    expect(paperSchema.safeParse(withQuestion(1, { marks: 3 })).success).toBe(false);
    expect(paperSchema.safeParse(withQuestion(1, { parts: [] })).success).toBe(false);
    expect(
      paperSchema.safeParse(withQuestion(1, { parts: section!.questions[1]!.parts!.toReversed() }))
        .success,
    ).toBe(false);
    expect(paperSchema.safeParse(withQuestion(2, { text: 'No blanks here.' })).success).toBe(false);
    expect(
      paperSchema.safeParse(withQuestion(3, { parts: section!.questions[1]!.parts })).success,
    ).toBe(false);
  });
});
