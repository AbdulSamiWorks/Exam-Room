import { describe, expect, it } from 'vitest';
import {
  answerKeyFromLetters,
  buildAnswerSheet,
  lettersOfAnswerKey,
  withChosenOptions,
} from './answer-sheet';
import { describePaperProblem } from './imported-paper';
import { detectPaperFormat, editableTextOf, importPaper } from './import-paper';
import { parsePaperJson } from './paper-json-format';
import { canWriteAsText } from './paper-text-format';

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

describe('JSON papers with parts, short answers and blanks', () => {
  const json = JSON.stringify({
    questions: [
      {
        type: 'parts',
        text: 'Change into negative sentences.',
        marks: 2,
        parts: [
          {
            text: 'The shopkeeper sells fresh fruit.',
            answers: ['The shopkeeper does not sell fresh fruit.'],
          },
          { text: 'Write one sentence about your shop.', answer: 'Any negative sentence.' },
        ],
      },
      {
        text: 'Translate: وہ اسکول گیا۔',
        answers: ['He went to school.', 'He has gone to school.'],
      },
      { text: 'He (1) _____ and (2) _____.', marks: 1, answers: ['ran', ['went', 'had gone']] },
      { type: 'blanks', text: 'It _____ .', answer: 'rains | is raining' },
    ],
  });

  it('reads every kind with its answers', () => {
    const { paper, answerKey, problems } = parsePaperJson(json);
    expect(problems).toEqual([]);
    const questions = paper.sections[0]?.questions ?? [];
    expect(questions.map((question) => question.kind)).toEqual([
      'parts',
      'short',
      'blanks',
      'blanks',
    ]);
    expect(questions[0]?.parts?.map((part) => [part.id, part.kind, part.marks])).toEqual([
      ['q1a', 'short', 1],
      ['q1b', 'written', 1],
    ]);
    expect(answerKey).toEqual({
      q1a: { accepted: ['The shopkeeper does not sell fresh fruit.'] },
      q1b: { text: 'Any negative sentence.' },
      q2: { accepted: ['He went to school.', 'He has gone to school.'] },
      q3: { blanks: [['ran'], ['went', 'had gone']] },
      q4: { blanks: [['rains', 'is raining']] },
    });
  });

  it('writes papers that text cannot hold as JSON that reads the same', () => {
    const imported = parsePaperJson(json);
    expect(canWriteAsText(imported.paper)).toBe(false);
    const again = importPaper(editableTextOf(imported.paper, imported.answerKey));
    expect(again.problems).toEqual([]);
    expect(again.paper).toEqual(imported.paper);
    expect(again.answerKey).toEqual(imported.answerKey);
  });

  it('explains blanks without the right number of answers', () => {
    const { problems } = parsePaperJson(
      JSON.stringify({ questions: [{ text: 'A _____ B _____', answers: ['x'] }] }),
    );
    expect(problems.map(describePaperProblem)).toEqual([
      'Question 1: there are 2 blanks but 1 answers.',
    ]);
  });
});
