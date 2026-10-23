import { describe, expect, it } from 'vitest';
import { describePaperProblem } from './imported-paper';
import { paperToText, parsePaperText } from './paper-text-format';

const SAMPLE = `Answer all questions.

# Section A: Multiple choice
Choose the best answer.

1. What is the SI unit of force? [1 mark]
a) Joule
b) Newton
c) Watt
d) Pascal
Answer: b

Q2. Which of these is a vector?
(A) Mass
(B) Velocity
Ans: B

# Section B: Short answers

3. State Newton's first law
of motion. (3 marks)
Answer: An object stays at rest unless a force acts on it.

4. Answer both parts.
a) Define speed. [2]
b) Define velocity. [2]
`;

describe('parsePaperText', () => {
  it('reads sections, questions, options, marks and answers', () => {
    const { paper, answerKey, problems, warnings } = parsePaperText(SAMPLE);

    expect(problems).toEqual([]);
    expect(warnings.map(describePaperProblem)).toEqual([
      'Line 13: no marks given, so question 2 counts 1 mark.',
    ]);
    expect(paper.instructions).toBe('Answer all questions.');
    expect(paper.sections.map((section) => [section.title, section.instructions])).toEqual([
      ['Section A: Multiple choice', 'Choose the best answer.'],
      ['Section B: Short answers', ''],
    ]);
    expect(paper.sections[0]?.questions).toEqual([
      {
        id: 'q1',
        kind: 'mcq',
        text: 'What is the SI unit of force?',
        marks: 1,
        options: ['Joule', 'Newton', 'Watt', 'Pascal'],
        imageNumber: null,
      },
      {
        id: 'q2',
        kind: 'mcq',
        text: 'Which of these is a vector?',
        marks: 1,
        options: ['Mass', 'Velocity'],
        imageNumber: null,
      },
    ]);
    expect(
      paper.sections[1]?.questions.map((question) => [
        question.kind,
        question.text,
        question.marks,
      ]),
    ).toEqual([
      ['written', "State Newton's first law\nof motion.", 3],
      ['written', 'Answer both parts.\na) Define speed. [2]\nb) Define velocity. [2]', 4],
    ]);
    expect(answerKey).toEqual({
      q1: { option: 1 },
      q2: { option: 1 },
      q3: { text: 'An object stays at rest unless a force acts on it.' },
    });
  });

  it('keeps Urdu text as it is', () => {
    const { paper, problems } = parsePaperText(
      '1. پاکستان کا دارالحکومت کون سا ہے؟ [1]\na) لاہور\nb) اسلام آباد\nAnswer: b',
    );
    expect(problems).toEqual([]);
    expect(paper.sections[0]?.questions[0]?.options).toEqual(['لاہور', 'اسلام آباد']);
  });

  it('explains mistakes with line numbers', () => {
    const { problems } = parsePaperText(
      'a) Lonely option\nAnswer: c\n1. Question [1]\na) Yes\nb) No\nAnswer: e\n2. One option [1]\na) Only',
    );
    expect(problems.map(describePaperProblem)).toEqual([
      'Line 1: this option comes before any question.',
      'Line 2: this answer comes before any question.',
      'Line 6: the answer must be one of the option letters A to B.',
      'Line 7: a multiple choice question needs at least 2 options.',
    ]);
  });

  it('says when there are no questions', () => {
    expect(parsePaperText('Just some words').problems.map(describePaperProblem)).toEqual([
      'No questions found. Start each question with 1. or Q1.',
    ]);
  });

  it('writes a paper back as text that reads the same', () => {
    const imported = parsePaperText(SAMPLE);
    const again = parsePaperText(paperToText(imported.paper, imported.answerKey));
    expect(again.paper).toEqual(imported.paper);
    expect(again.answerKey).toEqual(imported.answerKey);
  });
});
