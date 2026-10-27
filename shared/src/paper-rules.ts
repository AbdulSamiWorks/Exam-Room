import { z } from 'zod';
import type {
  AnswerKey,
  AnswerSlot,
  MarkableUnit,
  NumberedQuestion,
  Paper,
  PaperLimits,
  PaperQuestion,
  QuestionAnswer,
} from './paper.js';

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
  maxParts: 26,
  maxBlanks: 30,
  maxAcceptedAnswers: 10,
  maxAcceptedAnswerLength: 500,
};

export const MARK_STEP = 0.5;
export const QUESTION_ID = /^q\d{1,4}$/;
export const UNIT_ID = /^q\d{1,4}[a-z]?$/;
export const ANSWER_SLOT_ID = /^q\d{1,4}[a-z]?(?:\.\d{1,2})?$/;

const OPTION_LETTERS = 'abcdef';
const PART_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const BLANK_MARKER = /_{3,}/g;
const BLANK_SLOT_SEPARATOR = '.';

const text = (maxLength: number) => z.string().trim().max(maxLength);

const marksSchema = z
  .number()
  .positive('Marks must be more than 0.')
  .max(paperLimits.maxMarksPerQuestion)
  .multipleOf(MARK_STEP, 'Marks can be whole or half marks.');

const answerFields = {
  text: text(paperLimits.maxQuestionTextLength).min(1, 'Every question needs its text.'),
  marks: marksSchema,
  options: z.array(text(paperLimits.maxOptionTextLength).min(1)).max(paperLimits.maxOptions),
};

const partSchema = z
  .object({
    id: z.string().regex(UNIT_ID),
    kind: z.enum(['written', 'short', 'blanks']),
    ...answerFields,
  })
  .superRefine((part, context) => {
    const problem = answerShapeProblem(part);
    if (problem) context.addIssue({ code: 'custom', message: problem });
  });

const questionSchema = z
  .object({
    id: z.string().regex(QUESTION_ID),
    kind: z.enum(['mcq', 'written', 'short', 'blanks', 'parts']),
    ...answerFields,
    imageNumber: z.number().int().min(1).max(paperLimits.maxPaperImages).nullable(),
    parts: z.array(partSchema).max(paperLimits.maxParts).optional(),
  })
  .superRefine((question, context) => {
    const problem = questionShapeProblem(question);
    if (problem) context.addIssue({ code: 'custom', message: problem });
  });

function answerShapeProblem(item: Pick<MarkableUnit, 'kind' | 'text' | 'options'>) {
  if (item.kind === 'mcq') {
    return item.options.length >= paperLimits.minOptions
      ? undefined
      : `A multiple choice question needs ${paperLimits.minOptions} to ${paperLimits.maxOptions} options.`;
  }
  if (item.options.length > 0) return 'Only a multiple choice question has options.';
  if (item.kind === 'blanks') {
    const blankCount = blankCountOf(item.text);
    if (blankCount === 0) return 'A fill in the blanks question needs blanks written as _____.';
    if (blankCount > paperLimits.maxBlanks) {
      return `A question can have at most ${paperLimits.maxBlanks} blanks.`;
    }
  }
  return undefined;
}

function questionShapeProblem(question: PaperQuestion): string | undefined {
  const parts = question.parts ?? [];
  if (question.kind !== 'parts') {
    if (parts.length > 0) return 'Only a question with parts can have parts.';
    return answerShapeProblem({ ...question, kind: question.kind });
  }
  if (parts.length === 0) return 'A question with parts needs at least one part.';
  if (question.options.length > 0) return 'A question with parts has no options of its own.';
  if (parts.some((part, partIndex) => part.id !== partIdOf(question.id, partIndex))) {
    return 'Parts must be numbered a, b, c in order.';
  }
  const partMarks = parts.reduce((total, part) => total + part.marks, 0);
  return partMarks === question.marks
    ? undefined
    : 'The marks of a question must be the marks of its parts added up.';
}

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

const acceptedAnswerSchema = text(paperLimits.maxAcceptedAnswerLength).min(1);

export const answerKeySchema = z.record(
  z.string().regex(UNIT_ID),
  z.object({
    option: z
      .number()
      .int()
      .min(0)
      .max(paperLimits.maxOptions - 1)
      .optional(),
    text: text(paperLimits.maxModelAnswerLength).optional(),
    accepted: z.array(acceptedAnswerSchema).min(1).max(paperLimits.maxAcceptedAnswers).optional(),
    blanks: z
      .array(z.array(acceptedAnswerSchema).min(1).max(paperLimits.maxAcceptedAnswers))
      .min(1)
      .max(paperLimits.maxBlanks)
      .optional(),
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

export function partLetter(partIndex: number): string {
  return PART_LETTERS[partIndex] ?? '?';
}

export function partIdOf(questionId: string, partIndex: number): string {
  return `${questionId}${partLetter(partIndex)}`;
}

export function unitsOfQuestion(question: NumberedQuestion): MarkableUnit[] {
  if (question.kind !== 'parts') {
    return [
      {
        id: question.id,
        kind: question.kind,
        text: question.text,
        marks: question.marks,
        options: question.options,
        questionId: question.id,
        questionNumber: question.number,
        partLetter: null,
        label: String(question.number),
      },
    ];
  }
  return (question.parts ?? []).map((part, partIndex) => ({
    ...part,
    questionId: question.id,
    questionNumber: question.number,
    partLetter: partLetter(partIndex),
    label: `${question.number}(${partLetter(partIndex)})`,
  }));
}

export function markableUnitsOf(paper: Paper): MarkableUnit[] {
  return numberQuestions(paper).flatMap(unitsOfQuestion);
}

export function blankCountOf(text: string): number {
  return text.match(BLANK_MARKER)?.length ?? 0;
}

export function textAroundBlanks(text: string): string[] {
  return text.split(BLANK_MARKER);
}

export function blankSlotId(unitId: string, blankIndex: number): string {
  return `${unitId}${BLANK_SLOT_SEPARATOR}${blankIndex + 1}`;
}

export function unitIdOfSlot(slotId: string): string {
  return slotId.split(BLANK_SLOT_SEPARATOR)[0] ?? slotId;
}

export function slotsOfUnit(unit: MarkableUnit): AnswerSlot[] {
  if (unit.kind !== 'blanks') return [{ slotId: unit.id, unit, blankIndex: null }];
  return Array.from({ length: blankCountOf(unit.text) }, (_blank, blankIndex) => ({
    slotId: blankSlotId(unit.id, blankIndex),
    unit,
    blankIndex,
  }));
}

export function answerSlotsOf(paper: Paper): Map<string, AnswerSlot> {
  return new Map(
    markableUnitsOf(paper)
      .flatMap(slotsOfUnit)
      .map((slot) => [slot.slotId, slot]),
  );
}

export function checksAutomatically(
  unit: Pick<MarkableUnit, 'kind' | 'text'>,
  answer: QuestionAnswer | undefined,
): boolean {
  if (unit.kind === 'mcq') return true;
  if (unit.kind === 'short') return (answer?.accepted?.length ?? 0) > 0;
  if (unit.kind === 'blanks') return answer?.blanks?.length === blankCountOf(unit.text);
  return false;
}

export function maxMarksOf(paper: Paper): number {
  return questionsOf(paper).reduce((total, question) => total + question.marks, 0);
}

export function highestImageNumber(paper: Paper): number {
  return Math.max(0, ...questionsOf(paper).map((question) => question.imageNumber ?? 0));
}

export function answerKeyProblems(paper: Paper, answerKey: AnswerKey): string[] {
  const unitsById = new Map(markableUnitsOf(paper).map((unit) => [unit.id, unit]));
  return Object.entries(answerKey).flatMap(([unitId, answer]) => {
    const unit = unitsById.get(unitId);
    if (!unit) return [`The answer key names a question that is not on the paper.`];
    const problem = answerProblemOf(unit, answer);
    return problem ? [problem] : [];
  });
}

export function keepAnswersOfPaper(paper: Paper, answerKey: AnswerKey): AnswerKey {
  const unitsById = new Map(markableUnitsOf(paper).map((unit) => [unit.id, unit]));
  return Object.fromEntries(
    Object.entries(answerKey).filter(([unitId, answer]) => {
      const unit = unitsById.get(unitId);
      return unit !== undefined && answerProblemOf(unit, answer) === undefined;
    }),
  );
}

function answerProblemOf(unit: MarkableUnit, answer: QuestionAnswer): string | undefined {
  if (answer.option !== undefined) {
    if (unit.kind !== 'mcq' || answer.option >= unit.options.length) {
      return `Question ${unit.label} has no option ${optionLetter(answer.option)}.`;
    }
  }
  if (answer.accepted !== undefined && unit.kind !== 'short') {
    return `Question ${unit.label} does not take a short answer.`;
  }
  if (answer.blanks !== undefined) {
    const blankCount = unit.kind === 'blanks' ? blankCountOf(unit.text) : 0;
    if (answer.blanks.length !== blankCount) {
      return `Question ${unit.label} has ${blankCount} blanks but the key gives ${answer.blanks.length} answers.`;
    }
  }
  return undefined;
}

export function optionLetter(optionIndex: number): string {
  return OPTION_LETTERS[optionIndex]?.toUpperCase() ?? '?';
}

export function optionIndexOf(letter: string): number | undefined {
  const index = OPTION_LETTERS.indexOf(letter.trim().toLowerCase());
  return letter.trim().length === 1 && index !== -1 ? index : undefined;
}
