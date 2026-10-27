import type {
  AnswerKey,
  Paper,
  PaperQuestion,
  QuestionAnswer,
  QuestionPart,
} from '@exam-room/shared';
import { blankCountOf, optionIndexOf, optionLetter, partIdOf } from '@exam-room/shared/paper-rules';
import { z } from 'zod';
import {
  DEFAULT_MARKS,
  questionIdFor,
  schemaProblems,
  splitBlankAnswers,
  splitPartMarks,
  type ImportedPaper,
  type PaperProblem,
} from './imported-paper';

const JSON_LINE = /line (\d+)/;
const JSON_POSITION = /position (\d+)/;
const JSON_INDENT = 2;
const BLANK_MARKER = /_{3,}/;

const answersInputSchema = z.array(z.union([z.string(), z.array(z.string())]));

const partInputSchema = z.object({
  type: z.enum(['written', 'short', 'blanks']).optional(),
  text: z.string(),
  marks: z.number().optional(),
  answer: z.string().optional(),
  answers: answersInputSchema.optional(),
});

const questionInputSchema = z.object({
  type: z.enum(['mcq', 'written', 'short', 'blanks', 'parts']).optional(),
  text: z.string(),
  marks: z.number().optional(),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
  answers: answersInputSchema.optional(),
  parts: z.array(partInputSchema).optional(),
});

const sectionInputSchema = z.object({
  title: z.string().optional(),
  instructions: z.string().optional(),
  questions: z.array(questionInputSchema),
});

const paperInputSchema = z.object({
  instructions: z.string().optional(),
  sections: z.array(sectionInputSchema).optional(),
  questions: z.array(questionInputSchema).optional(),
});

type QuestionInput = z.infer<typeof questionInputSchema>;
type PartInput = z.infer<typeof partInputSchema>;
type AnswersInput = z.infer<typeof answersInputSchema>;

const EMPTY_PAPER: Paper = { instructions: '', sections: [] };

export function parsePaperJson(text: string): ImportedPaper {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch (error) {
    return failed({
      lineNumber: jsonErrorLine(text, error),
      message: 'this is not valid JSON. Check the commas and quotes near here.',
    });
  }

  const parsed = paperInputSchema.safeParse(input);
  if (!parsed.success) {
    const [issue] = parsed.error.issues;
    return failed({
      lineNumber: 0,
      message: `${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'not a paper.'}`,
    });
  }

  const sectionInputs = parsed.data.sections ?? [
    { title: '', instructions: '', questions: parsed.data.questions ?? [] },
  ];
  const answerKey: AnswerKey = {};
  const problems: PaperProblem[] = [];
  const warnings: PaperProblem[] = [];
  let questionIndex = 0;

  const paper: Paper = {
    instructions: parsed.data.instructions?.trim() ?? '',
    sections: sectionInputs.map((section) => ({
      title: section.title?.trim() ?? '',
      instructions: section.instructions?.trim() ?? '',
      questions: section.questions.map((questionInput) => {
        const questionNumber = questionIndex + 1;
        const report = (message: string) =>
          problems.push({ lineNumber: 0, message: `Question ${questionNumber}: ${message}` });
        const question = toQuestion(questionInput, questionIdFor(questionIndex), report);
        questionIndex += 1;
        if (questionInput.marks === undefined && !hasPartMarks(questionInput)) {
          warnings.push({
            lineNumber: 0,
            message: `Question ${questionNumber} has no marks, so it counts ${question.marks} ${question.marks === 1 ? 'mark' : 'marks'}.`,
          });
        }
        addAnswers(question, questionInput, answerKey, report);
        return question;
      }),
    })),
  };

  if (questionIndex === 0) problems.push({ lineNumber: 0, message: 'The paper has no questions.' });
  return {
    paper,
    answerKey,
    problems: problems.length > 0 ? problems : schemaProblems(paper),
    warnings,
  };
}

function hasPartMarks(input: QuestionInput): boolean {
  return (input.parts ?? []).some((part) => part.marks !== undefined);
}

function toQuestion(
  input: QuestionInput,
  id: string,
  report: (message: string) => void,
): PaperQuestion {
  const options = (input.options ?? []).map((option) => option.trim());
  const kind = input.type ?? inferredKind(input, options);
  const text = input.text.trim();
  if (kind === 'parts') {
    const partInputs = input.parts ?? [];
    const { partMarks, totalMarks, problem } = splitPartMarks(
      input.marks,
      partInputs.map((part) => part.marks),
    );
    if (problem) report(problem);
    const parts: QuestionPart[] = partInputs.map((part, partIndex) => ({
      id: partIdOf(id, partIndex),
      kind: part.type ?? inferredPartKind(part),
      text: part.text.trim(),
      marks: partMarks[partIndex] ?? DEFAULT_MARKS,
      options: [],
    }));
    return { id, kind, text, marks: totalMarks, options: [], imageNumber: null, parts };
  }
  return {
    id,
    kind,
    text,
    marks: input.marks ?? DEFAULT_MARKS,
    options: kind === 'mcq' ? options : [],
    imageNumber: null,
  };
}

function inferredKind(input: QuestionInput, options: readonly string[]): PaperQuestion['kind'] {
  if (input.parts) return 'parts';
  if (options.length > 0) return 'mcq';
  if (input.answers) return BLANK_MARKER.test(input.text) ? 'blanks' : 'short';
  return 'written';
}

function inferredPartKind(part: PartInput): QuestionPart['kind'] {
  if (BLANK_MARKER.test(part.text)) return 'blanks';
  return part.answer !== undefined && part.answers === undefined ? 'written' : 'short';
}

function addAnswers(
  question: PaperQuestion,
  input: QuestionInput,
  answerKey: AnswerKey,
  report: (message: string) => void,
): void {
  if (question.kind === 'parts') {
    (question.parts ?? []).forEach((part, partIndex) => {
      const partInput = input.parts?.[partIndex];
      const answer = partInput && keyOf(part, partInput, report);
      if (answer) answerKey[part.id] = answer;
    });
    return;
  }
  const answer = keyOf(question, input, report);
  if (answer) answerKey[question.id] = answer;
}

function keyOf(
  unit: Pick<PaperQuestion, 'kind' | 'text' | 'options'>,
  input: Pick<QuestionInput, 'answer' | 'answers'>,
  report: (message: string) => void,
): QuestionAnswer | undefined {
  const answer = input.answer?.trim();
  if (unit.kind === 'mcq') {
    if (!answer) return undefined;
    const option = optionIndexOf(answer);
    if (option === undefined || option >= unit.options.length) {
      report(
        `the answer must be one of the option letters A to ${optionLetter(unit.options.length - 1)}.`,
      );
      return undefined;
    }
    return { option };
  }
  if (unit.kind === 'short') {
    const accepted = acceptedOf(input.answers ?? (answer ? [answer] : []));
    return accepted.length > 0 ? { accepted } : undefined;
  }
  if (unit.kind === 'blanks') {
    const blankAnswers =
      input.answers ?? (answer ? splitBlankAnswers(answer, blankCountOf(unit.text)) : undefined);
    return blanksKeyOf(unit.text, blankAnswers, report);
  }
  return answer ? { text: answer } : undefined;
}

function acceptedOf(answers: AnswersInput): string[] {
  return answers
    .flat()
    .map((answer) => answer.trim())
    .filter(Boolean);
}

function blanksKeyOf(
  text: string,
  answers: AnswersInput | undefined,
  report: (message: string) => void,
): QuestionAnswer | undefined {
  if (!answers) return undefined;
  const blanks = answers.map((answer) => acceptedOf([answer]));
  const blankCount = blankCountOf(text);
  if (blanks.length !== blankCount || blanks.some((accepted) => accepted.length === 0)) {
    report(`there are ${blankCount} blanks but ${blanks.length} answers.`);
    return undefined;
  }
  return { blanks };
}

export function paperToJson(paper: Paper, answerKey: AnswerKey): string {
  return `${JSON.stringify(
    {
      instructions: paper.instructions,
      sections: paper.sections.map((section) => ({
        title: section.title,
        instructions: section.instructions,
        questions: section.questions.map((question) => questionToInput(question, answerKey)),
      })),
    },
    null,
    JSON_INDENT,
  )}\n`;
}

function questionToInput(question: PaperQuestion, answerKey: AnswerKey): QuestionInput {
  if (question.kind === 'parts') {
    return {
      type: 'parts',
      text: question.text,
      marks: question.marks,
      parts: (question.parts ?? []).map((part) => ({
        type: part.kind,
        text: part.text,
        marks: part.marks,
        ...answerToInput(answerKey[part.id]),
      })),
    };
  }
  return {
    type: question.kind,
    text: question.text,
    marks: question.marks,
    ...(question.kind === 'mcq' ? { options: question.options } : {}),
    ...answerToInput(answerKey[question.id]),
  };
}

function answerToInput(
  answer: QuestionAnswer | undefined,
): Pick<QuestionInput, 'answer' | 'answers'> {
  if (answer?.option !== undefined) return { answer: optionLetter(answer.option).toLowerCase() };
  if (answer?.accepted) return { answers: answer.accepted };
  if (answer?.blanks) return { answers: answer.blanks };
  return answer?.text ? { answer: answer.text } : {};
}

function failed(problem: PaperProblem): ImportedPaper {
  return { paper: EMPTY_PAPER, answerKey: {}, problems: [problem], warnings: [] };
}

function jsonErrorLine(text: string, error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  const line = Number(JSON_LINE.exec(message)?.[1]);
  if (Number.isInteger(line)) return line;
  const position = Number(JSON_POSITION.exec(message)?.[1]);
  return Number.isInteger(position) ? text.slice(0, position).split('\n').length : 0;
}
