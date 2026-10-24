import { z } from 'zod';
import type { AnswerKey, NumberedQuestion, Paper, PaperLimits } from './paper.js';

export const paperLimits: PaperLimits = {
  maxQuestions: 200,
  maxSections: 20,
  minOptions: 2,
  maxOptions: 6,
  maxQuestionTextLength: 2000,
  maxOptionTextLength: 500,
  maxTitleLength: 200,
  maxInstructionsLength: 2000,
  maxModelAnswerLength: 2000,
  maxMarksPerQuestion: 100,
  maxPaperImages: 20,
  maxPaperImageBytes: 1_000_000,
};

const MARK_STEP = 0.5;
const QUESTION_ID = /^q\d{1,4}$/;
const OPTION_LETTERS = 'abcdef';

const text = (maxLength: number) => z.string().trim().max(maxLength);

const questionSchema = z
  .object({
    id: z.string().regex(QUESTION_ID),
    kind: z.enum(['mcq', 'written']),
    text: text(paperLimits.maxQuestionTextLength).min(1, 'Every question needs its text.'),
    marks: z
      .number()
      .positive('Marks must be more than 0.')
      .max(paperLimits.maxMarksPerQuestion)
      .multipleOf(MARK_STEP, 'Marks can be whole or half marks.'),
    options: z.array(text(paperLimits.maxOptionTextLength).min(1)).max(paperLimits.maxOptions),
    imageNumber: z.number().int().min(1).max(paperLimits.maxPaperImages).nullable(),
  })
  .refine(
    (question) =>
      question.kind === 'written'
        ? question.options.length === 0
        : question.options.length >= paperLimits.minOptions,
    `A multiple choice question needs ${paperLimits.minOptions} to ${paperLimits.maxOptions} options.`,
  );

export const paperSchema = z
  .object({
    instructions: text(paperLimits.maxInstructionsLength),
    sections: z
      .array(
        z.object({
          title: text(paperLimits.maxTitleLength),
          instructions: text(paperLimits.maxInstructionsLength),
          questions: z.array(questionSchema).min(1, 'Every section needs a question.'),
        }),
      )
      .min(1, 'Add at least one question.')
      .max(paperLimits.maxSections),
  })
  .refine(
    (paper) => questionsOf(paper).length <= paperLimits.maxQuestions,
    `A paper can have at most ${paperLimits.maxQuestions} questions.`,
  )
  .refine(
    (paper) =>
      new Set(questionsOf(paper).map((question) => question.id)).size === questionsOf(paper).length,
    'Every question needs its own id.',
  );

export const answerKeySchema = z.record(
  z.string().regex(QUESTION_ID),
  z.object({
    option: z
      .number()
      .int()
      .min(0)
      .max(paperLimits.maxOptions - 1)
      .optional(),
    text: text(paperLimits.maxModelAnswerLength).optional(),
  }),
);

export function questionsOf(paper: Pick<Paper, 'sections'>) {
  return paper.sections.flatMap((section) => section.questions);
}

export function numberQuestions(paper: Paper): NumberedQuestion[] {
  let number = 0;
  return paper.sections.flatMap((section, sectionIndex) =>
    section.questions.map((question) => {
      number += 1;
      return { ...question, number, sectionIndex };
    }),
  );
}

export function maxMarksOf(paper: Paper): number {
  return questionsOf(paper).reduce((total, question) => total + question.marks, 0);
}

export function highestImageNumber(paper: Paper): number {
  return Math.max(0, ...questionsOf(paper).map((question) => question.imageNumber ?? 0));
}

export function answerKeyProblems(paper: Paper, answerKey: AnswerKey): string[] {
  const questionsById = new Map(numberQuestions(paper).map((question) => [question.id, question]));
  return Object.entries(answerKey).flatMap(([questionId, answer]) => {
    const question = questionsById.get(questionId);
    if (!question) return [`The answer key names a question that is not on the paper.`];
    if (answer.option === undefined) return [];
    if (question.kind !== 'mcq' || answer.option >= question.options.length) {
      return [`Question ${question.number} has no option ${optionLetter(answer.option)}.`];
    }
    return [];
  });
}

export function keepAnswersOfPaper(paper: Paper, answerKey: AnswerKey): AnswerKey {
  const questionsById = new Map(questionsOf(paper).map((question) => [question.id, question]));
  return Object.fromEntries(
    Object.entries(answerKey).filter(([questionId, answer]) => {
      const question = questionsById.get(questionId);
      if (!question) return false;
      return answer.option === undefined || answer.option < question.options.length;
    }),
  );
}

export function optionLetter(optionIndex: number): string {
  return OPTION_LETTERS[optionIndex]?.toUpperCase() ?? '?';
}

export function optionIndexOf(letter: string): number | undefined {
  const index = OPTION_LETTERS.indexOf(letter.trim().toLowerCase());
  return letter.trim().length === 1 && index !== -1 ? index : undefined;
}
