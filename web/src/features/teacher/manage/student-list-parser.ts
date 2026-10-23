import type { NewStudent } from '@exam-room/shared';
import { studentLimits } from '../../../lib/student-limits';

export type StudentListProblem = {
  lineNumber: number;
  message: string;
};

export type ParsedStudentList = {
  students: NewStudent[];
  problems: StudentListProblem[];
};

const SEPARATOR_CHARACTERS = /[,;\t]/;
const FIRST_WHITESPACE = /\s+/;
const ROLL_NUMBER_ENDINGS = /[.):-]+$/;
const NAME_STARTS = /^[\s.):-]+/;
const RUNS_OF_WHITESPACE = /\s+/g;

export function parseStudentList(text: string): ParsedStudentList {
  const students: NewStudent[] = [];
  const problems: StudentListProblem[] = [];
  const lineNumberByRollKey = new Map<string, number>();

  text.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    if (!line.trim()) return;

    const { rollNumber, name } = splitLine(line);
    const problem = findProblem(
      rollNumber,
      name,
      lineNumberByRollKey.get(rollNumber.toLowerCase()),
    );
    if (problem) {
      problems.push({ lineNumber, message: problem });
      return;
    }
    lineNumberByRollKey.set(rollNumber.toLowerCase(), lineNumber);
    students.push({ rollNumber, name });
  });

  if (students.length > studentLimits.maxStudentsPerRequest) {
    problems.push({
      lineNumber: 0,
      message: `Add at most ${studentLimits.maxStudentsPerRequest} students at a time.`,
    });
  }
  return { students, problems };
}

export function describeProblem({ lineNumber, message }: StudentListProblem): string {
  return lineNumber > 0 ? `Line ${lineNumber}: ${message}` : message;
}

function splitLine(line: string): NewStudent {
  const trimmedLine = line.trim();
  const separator = SEPARATOR_CHARACTERS.exec(trimmedLine) ?? FIRST_WHITESPACE.exec(trimmedLine);
  const rollPart = separator ? trimmedLine.slice(0, separator.index) : trimmedLine;
  const namePart = separator ? trimmedLine.slice(separator.index + separator[0].length) : '';
  return {
    rollNumber: tidy(rollPart.replace(ROLL_NUMBER_ENDINGS, '')),
    name: tidy(namePart.replace(NAME_STARTS, '')),
  };
}

function findProblem(
  rollNumber: string,
  name: string,
  earlierLineNumber: number | undefined,
): string | undefined {
  if (!rollNumber) return 'start the line with the roll number.';
  if (!name) return 'add the name after the roll number.';
  if (rollNumber.length > studentLimits.maxRollNumberLength) {
    return `the roll number can have at most ${studentLimits.maxRollNumberLength} characters.`;
  }
  if (name.length > studentLimits.maxNameLength) {
    return `the name can have at most ${studentLimits.maxNameLength} characters.`;
  }
  if (earlierLineNumber !== undefined) {
    return `roll number ${rollNumber} is already on line ${earlierLineNumber}.`;
  }
  return undefined;
}

function tidy(text: string): string {
  return text.trim().replace(RUNS_OF_WHITESPACE, ' ');
}
