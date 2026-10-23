import { describe, expect, it } from 'vitest';
import {
  answerKeyFromLetters,
  buildAnswerSheet,
  lettersOfAnswerKey,
  withChosenOptions,
} from './answer-sheet';
import { describePaperProblem } from './imported-paper';
import { detectPaperFormat, importPaper } from './import-paper';

describe('JSON papers', () => {
  it('reads sections, guesses the question type and collects the answers', () => {
    const { paper, answerKey, problems, warnings } = importPaper(
      JSON.stringify({
        instructions: 'Answer all questions.',
        sections: [
          {
            title: 'Section A',
            questions: [
              { text: 'Unit of force?', marks: 1, options: ['Joule', 'Newton'], answer: 'b' },
              { type: 'written', text: 'Define work.', answer: 'Force times distance.' },
            ],
          },
        ],
      }),
    );

    expect(problems).toEqual([]);
    expect(warnings.map(describePaperProblem)).toEqual([
      'Question 2 has no marks, so it counts 1 mark.',
    ]);
    expect(paper.sections[0]?.questions.map((question) => [question.id, question.kind])).toEqual([
      ['q1', 'mcq'],
      ['q2', 'written'],
    ]);
    expect(answerKey).toEqual({ q1: { option: 1 }, q2: { text: 'Force times distance.' } });
  });

  it('accepts a plain list of questions without sections', () => {
    const { paper, problems } = importPaper('{"questions": [{"text": "Explain.", "marks": 2}]}');
    expect(problems).toEqual([]);
    expect(paper.sections).toHaveLength(1);
  });

  it('points at the line of broken JSON and at wrong answers', () => {
    expect(importPaper('{\n  "questions": [],\n}').problems.map(describePaperProblem)).toEqual([
      'Line 3: this is not valid JSON. Check the commas and quotes near here.',
    ]);
    expect(
      importPaper(
        '{"questions": [{"text": "A?", "options": ["x", "y"], "answer": "c"}]}',
      ).problems.map(describePaperProblem),
    ).toEqual(['Question 1: the answer must be one of the option letters A to B.']);
  });

  it('tells JSON from text', () => {
    expect(detectPaperFormat('  {"questions": []}')).toBe('json');
    expect(detectPaperFormat('1. Question')).toBe('text');
  });
});

describe('answer sheets for PDF tests', () => {
  const sheet = buildAnswerSheet({
    mcqCount: 3,
    optionCount: 4,
    mcqMarks: 1,
    writtenCount: 2,
    writtenMarks: 5,
  });

  it('builds numbered MCQs and written questions', () => {
    expect(
      sheet.sections.map((section) => section.questions.map((question) => question.id)),
    ).toEqual([
      ['q1', 'q2', 'q3'],
      ['q4', 'q5'],
    ]);
    expect(sheet.sections[0]?.questions[0]?.options).toEqual(['A', 'B', 'C', 'D']);
    expect(sheet.sections[1]?.questions[1]).toMatchObject({ text: 'Question 5', marks: 5 });
  });

  it('reads the answers from letters in any spacing', () => {
    expect(answerKeyFromLetters(sheet, '1-b, 2-D 3 a').answerKey).toEqual({
      q1: { option: 1 },
      q2: { option: 3 },
      q3: { option: 0 },
    });
    expect(answerKeyFromLetters(sheet, 'ab').answerKey).toEqual({
      q1: { option: 0 },
      q2: { option: 1 },
    });
    expect(answerKeyFromLetters(sheet, 'abcd').problem).toBe(
      'There are 4 letters but only 3 questions.',
    );
    expect(answerKeyFromLetters(sheet, 'ae').problem).toBe('Answer 2 (E) is not an option.');
    expect(lettersOfAnswerKey(sheet, { q1: { option: 1 }, q3: { option: 2 } })).toBe('B?C');
    expect(answerKeyFromLetters(sheet, 'B?C').answerKey).toEqual({
      q1: { option: 1 },
      q3: { option: 2 },
    });
  });

  it('replaces the chosen options and keeps model answers', () => {
    expect(
      withChosenOptions(
        { q1: { option: 0 }, q2: { option: 1 }, q4: { text: 'Model' } },
        { q2: { option: 3 } },
      ),
    ).toEqual({ q2: { option: 3 }, q4: { text: 'Model' } });
  });
});
