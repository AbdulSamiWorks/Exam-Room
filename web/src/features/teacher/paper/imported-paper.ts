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
