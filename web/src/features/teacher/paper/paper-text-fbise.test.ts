import { maxMarksOf, questionsOf } from '@exam-room/shared/paper-rules';
import { describe, expect, it } from 'vitest';
import { parsePaperText } from './paper-text-format';
import { SAMPLE_PAPER_TEXT } from './sample-paper';
import pastedPaper from './test-papers/fbise-computer-science-as-pasted.txt?raw';

describe('a Federal Board paper pasted as the teacher wrote it', () => {
  const { paper, answerKey, problems } = parsePaperText(pastedPaper);
  const questions = questionsOf(paper);

  it('reads every section, question and mark without problems', () => {
    expect(problems).toEqual([]);
    expect(paper.sections.map((section) => section.title)).toEqual([
      'Section A: Multiple choice (25 marks)',
      'Section B: Short answers (15 marks)',
      'Section C: Detailed answers (10 marks)',
    ]);
    expect(questions).toHaveLength(32);
    expect(maxMarksOf(paper)).toBe(50);
    expect(questions.slice(25).map((question) => question.marks)).toEqual([3, 3, 3, 3, 3, 5, 5]);
  });

  it('splits options written on one line and keeps their answers', () => {
    expect(questions[0]?.options).toEqual([
      'analog signal',
      'continuous signal',
      'digital signal',
      'sine wave',
    ]);
    expect(questions.slice(0, 25).every((question) => question.options.length === 4)).toBe(true);
    const letters = questions
      .slice(0, 25)
      .map((question) => 'abcd'[answerKey[question.id]?.option ?? -1])
      .join('');
    expect(letters).toBe('cadbdcbadccbadbadcbdacdba');
  });

  it('keeps parts in the question and the model answer for the teacher only', () => {
    const duality = questions[27];
    expect(duality?.kind).toBe('written');
    expect(duality?.text).toContain("a) A + A' = 1");
    expect(answerKey[duality?.id ?? '']?.text).toContain("a) A·A' = 0 [1]");
    const truthTable = questions[26];
    expect(truthTable?.text).toBe(
      "Draw the truth table for the Boolean expression F = (A + B)·C'.",
    );
    expect(answerKey[truthTable?.id ?? '']?.text).toContain('F = (A + B)·C');
  });

  it('leaves the name and roll number blanks out of the instructions', () => {
    expect(paper.instructions).toContain('Answer all questions. Write clearly.');
    expect(paper.instructions).not.toContain('____');
  });
});

describe('the Federal Board sample paper the app offers', () => {
  it('has 32 questions, 50 marks and the truth table as a real table', () => {
    const { paper, answerKey, problems } = parsePaperText(SAMPLE_PAPER_TEXT);
    const questions = questionsOf(paper);
    expect(problems).toEqual([]);
    expect(questions).toHaveLength(32);
    expect(maxMarksOf(paper)).toBe(50);
    expect(answerKey[questions[26]?.id ?? '']?.text).toContain('| 0 | 1 | 0 | 1 | 1 | 1 |');
  });
});

describe('a short answer section', () => {
  it('reads a) and b) lines without marks as parts of a written question', () => {
    const { paper, problems } = parsePaperText(
      '# Section B: Short answers\n28. Write the dual of each expression. [2 marks]\na) A + 0 = A\nb) A·1 = A',
    );
    expect(problems).toEqual([]);
    expect(questionsOf(paper)[0]).toMatchObject({
      kind: 'written',
      marks: 2,
      text: 'Write the dual of each expression.\na) A + 0 = A\nb) A·1 = A',
      options: [],
    });
  });
});
