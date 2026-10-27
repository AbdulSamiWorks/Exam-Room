import type { AnswerKey, Paper } from '@exam-room/shared';
import { paperSchema } from '@exam-room/shared/paper-rules';

export type PaperProblem = {
  lineNumber: number;
  message: string;
};

export type ImportedPaper = {
  paper: Paper;
  answerKey: AnswerKey;
  problems: PaperProblem[];
  warnings: PaperProblem[];
};

export function describePaperProblem({ lineNumber, message }: PaperProblem): string {
  return lineNumber > 0 ? `Line ${lineNumber}: ${message}` : message;
}

export function schemaProblems(paper: Paper): PaperProblem[] {
  const result = paperSchema.safeParse(paper);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    lineNumber: 0,
    message: `${describeIssuePath(paper, issue.path)}${issue.message}`,
  }));
}

function describeIssuePath(paper: Paper, path: readonly PropertyKey[]): string {
  const [sectionKey, sectionIndex, questionKey, questionIndex] = path;
  if (sectionKey !== 'sections' || typeof sectionIndex !== 'number') return '';
  if (questionKey !== 'questions' || typeof questionIndex !== 'number') {
    return `Section ${sectionIndex + 1}: `;
  }
  const questionsBefore = paper.sections
    .slice(0, sectionIndex)
    .reduce((total, section) => total + section.questions.length, 0);
  return `Question ${questionsBefore + questionIndex + 1}: `;
}

export function questionIdFor(questionIndex: number): string {
  return `q${questionIndex + 1}`;
}

export const DEFAULT_MARKS = 1;
export const ANSWER_ALTERNATIVES_SEPARATOR = '|';
export const BLANK_ANSWERS_SEPARATOR = ';';
const MARK_STEPS_PER_MARK = 2;

export type PartMarks = {
  partMarks: number[];
  totalMarks: number;
  problem: string | undefined;
};

export function splitPartMarks(
  questionMarks: number | undefined,
  givenPartMarks: ReadonlyArray<number | undefined>,
): PartMarks {
  const givenTotal = givenPartMarks.reduce<number>((total, marks) => total + (marks ?? 0), 0);
  const unmarkedCount = givenPartMarks.filter((marks) => marks === undefined).length;
  if (questionMarks === undefined) {
    const partMarks = givenPartMarks.map((marks) => marks ?? DEFAULT_MARKS);
    return {
      partMarks,
      totalMarks: givenTotal + unmarkedCount * DEFAULT_MARKS,
      problem: undefined,
    };
  }
  if (unmarkedCount === 0) {
    const problem =
      givenTotal === questionMarks
        ? undefined
        : `the parts add up to ${givenTotal} marks but the question has ${questionMarks}.`;
    return {
      partMarks: givenPartMarks.map((marks) => marks ?? 0),
      totalMarks: questionMarks,
      problem,
    };
  }
  const sharedMarks = (questionMarks - givenTotal) / unmarkedCount;
  const canShare = sharedMarks > 0 && Number.isInteger(sharedMarks * MARK_STEPS_PER_MARK);
  return {
    partMarks: givenPartMarks.map((marks) => marks ?? (canShare ? sharedMarks : DEFAULT_MARKS)),
    totalMarks: questionMarks,
    problem: canShare
      ? undefined
      : 'the marks cannot be shared equally between the parts in half marks. Give each part its marks, for example [1].',
  };
}

export function splitAlternatives(answer: string): string[] {
  return answer
    .split(ANSWER_ALTERNATIVES_SEPARATOR)
    .map((alternative) => alternative.trim())
    .filter(Boolean);
}

export function splitBlankAnswers(answer: string, blankCount: number): string[][] {
  const perBlank = blankCount > 1 ? answer.split(BLANK_ANSWERS_SEPARATOR) : [answer];
  return perBlank.map(splitAlternatives);
}
