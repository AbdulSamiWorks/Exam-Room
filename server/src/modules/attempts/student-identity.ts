import type { StudentLimits } from '@exam-room/shared';

export const studentLimits: StudentLimits = {
  maxNameLength: 60,
  maxRollNumberLength: 30,
};

const RUNS_OF_WHITESPACE = /\s+/g;

export function tidyText(text: string): string {
  return text.trim().replace(RUNS_OF_WHITESPACE, ' ');
}

export function comparisonKey(text: string): string {
  return tidyText(text).toLocaleLowerCase();
}
