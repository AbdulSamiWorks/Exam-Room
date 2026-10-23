import type { NewStudent } from '@exam-room/shared';
import { compareNaturally, comparisonKey } from '../../lib/text.js';

export function findRepeatedRollNumbers(students: readonly NewStudent[]): string[] {
  const firstSpellingByKey = new Map<string, string>();
  const repeated = new Set<string>();
  for (const { rollNumber } of students) {
    const key = comparisonKey(rollNumber);
    const firstSpelling = firstSpellingByKey.get(key);
    if (firstSpelling === undefined) firstSpellingByKey.set(key, rollNumber);
    else repeated.add(firstSpelling);
  }
  return [...repeated].sort(compareNaturally);
}

export function describeRepeatedRollNumbers(rollNumbers: readonly string[]): string {
  return `${rollNumbersWithVerb(rollNumbers)} in the list more than once.`;
}

export function describeTakenRollNumbers(
  rollNumbers: readonly string[],
  className: string,
): string {
  return `${rollNumbersWithVerb(rollNumbers)} already used in ${className}.`;
}

function rollNumbersWithVerb(rollNumbers: readonly string[]): string {
  return rollNumbers.length === 1
    ? `Roll number ${rollNumbers.join('')} is`
    : `Roll numbers ${rollNumbers.join(', ')} are`;
}
