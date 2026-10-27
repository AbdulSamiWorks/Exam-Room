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

describe('parts, short answers and blanks', () => {
  const GRAMMAR = `# Section B: Short answers
27. Change into negative sentences. [2 marks]
a) The shopkeeper sells fresh fruit.
Answer: The shopkeeper does not sell fresh fruit. | The shopkeeper doesn't sell fresh fruit.
b) I have locked the door.
Answer: I have not locked the door.

28. Read the passage and answer. [5 marks]
a) Why was Ahmed late? [2]
Model answer: His alarm clock stopped working
during the night.
b) Find a word that means "help".
Answer:
c) Ahmed _____ (wake) up late.
Answer: woke

29. Fill in the blanks. [1]
Ahmed (1) _____ (live) in Multan. Now he (2) _____ (study).
Answer: lives; is studying | studies
`;

  it('gives each answered part its own box, kind and marks', () => {
    const { paper, answerKey, problems, warnings } = parsePaperText(GRAMMAR);
    expect(problems).toEqual([]);
    expect(warnings).toEqual([]);
    const [negatives, passage, blanks] = paper.sections[0]?.questions ?? [];
    expect(negatives).toMatchObject({ kind: 'parts', text: 'Change into negative sentences.' });
    expect(negatives?.parts?.map((part) => [part.id, part.kind, part.marks, part.text])).toEqual([
      ['q1a', 'short', 1, 'The shopkeeper sells fresh fruit.'],
      ['q1b', 'short', 1, 'I have locked the door.'],
    ]);
    expect(passage?.parts?.map((part) => [part.kind, part.marks])).toEqual([
      ['written', 2],
      ['short', 1.5],
      ['blanks', 1.5],
    ]);
    expect(blanks).toMatchObject({ kind: 'blanks', marks: 1 });
    expect(answerKey).toEqual({
      q1a: {
        accepted: [
          'The shopkeeper does not sell fresh fruit.',
          "The shopkeeper doesn't sell fresh fruit.",
        ],
      },
      q1b: { accepted: ['I have not locked the door.'] },
      q2a: { text: 'His alarm clock stopped working\nduring the night.' },
      q2c: { blanks: [['woke']] },
      q3: { blanks: [['lives'], ['is studying', 'studies']] },
    });
  });

  it('writes parts and blanks back as text that reads the same', () => {
    const imported = parsePaperText(GRAMMAR);
    const again = parsePaperText(paperToText(imported.paper, imported.answerKey));
    expect(again.problems).toEqual([]);
    expect(again.paper).toEqual(imported.paper);
    expect(again.answerKey).toEqual(imported.answerKey);
  });

  it('explains blanks without the right number of answers and marks that cannot be shared', () => {
    const { problems } = parsePaperText(
      '1. Fill in. [1]\nHe (1) _____ and (2) _____.\nAnswer: went\n2. Parts [1]\na) One\nAnswer: x\nb) Two\nAnswer: y\nc) Three\nAnswer: z',
    );
    expect(problems.map(describePaperProblem)).toEqual([
      'Line 3: there are 2 blanks but 1 answers. Give one answer for each blank, in order, separated by ;',
      'Line 4: the marks cannot be shared equally between the parts in half marks. Give each part its marks, for example [1].',
    ]);
  });

  it('warns when an exact answer is long', () => {
    const longAnswer = Array.from({ length: 30 }, () => 'word').join(' ');
    const { warnings } = parsePaperText(`1. Explain. [2]\na) Why?\nAnswer: ${longAnswer}`);
    expect(warnings.map(describePaperProblem)).toEqual([
      'Line 3: this answer is long, and the app checks it word by word. If students may answer in their own words, write Model answer: instead.',
    ]);
  });

  it('keeps the old meaning of a model answer under several parts', () => {
    const { paper, answerKey } = parsePaperText(
      '1. Answer both parts. [2]\na) Define speed.\nb) Define velocity.\nAnswer: Speed is distance per time; velocity has a direction.',
    );
    expect(paper.sections[0]?.questions[0]).toMatchObject({ kind: 'written' });
    expect(answerKey.q1?.text).toContain('velocity has a direction');
  });
});
