import type { AnswerKey, Paper, PaperQuestion } from '@exam-room/shared';
import { optionIndexOf, optionLetter } from '@exam-room/shared/paper-rules';
import { z } from 'zod';
import {
  questionIdFor,
  schemaProblems,
  type ImportedPaper,
  type PaperProblem,
} from './imported-paper';

const DEFAULT_MARKS = 1;
const JSON_LINE = /line (\d+)/;
const JSON_POSITION = /position (\d+)/;

const questionInputSchema = z.object({
  type: z.enum(['mcq', 'written']).optional(),
  text: z.string(),
  marks: z.number().optional(),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
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
        const question = toQuestion(questionInput, questionIndex);
        questionIndex += 1;
        if (questionInput.marks === undefined) {
          warnings.push({
            lineNumber: 0,
            message: `Question ${questionIndex} has no marks, so it counts ${DEFAULT_MARKS} mark.`,
          });
        }
        const answerProblem = addAnswer(question, questionInput.answer, answerKey);
        if (answerProblem)
          problems.push({ lineNumber: 0, message: `Question ${questionIndex}: ${answerProblem}` });
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

function toQuestion(input: QuestionInput, questionIndex: number): PaperQuestion {
  const options = (input.options ?? []).map((option) => option.trim());
  const kind = input.type ?? (options.length > 0 ? 'mcq' : 'written');
  return {
    id: questionIdFor(questionIndex),
    kind,
    text: input.text.trim(),
    marks: input.marks ?? DEFAULT_MARKS,
    options: kind === 'mcq' ? options : [],
    imageNumber: null,
  };
}

function addAnswer(
  question: PaperQuestion,
  answer: string | undefined,
  answerKey: AnswerKey,
): string | undefined {
  if (!answer?.trim()) return undefined;
  if (question.kind === 'written') {
    answerKey[question.id] = { text: answer.trim() };
    return undefined;
  }
  const option = optionIndexOf(answer);
  if (option === undefined || option >= question.options.length) {
    return `the answer must be one of the option letters A to ${optionLetter(question.options.length - 1)}.`;
  }
  answerKey[question.id] = { option };
  return undefined;
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
