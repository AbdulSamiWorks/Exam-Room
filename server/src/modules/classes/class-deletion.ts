import { countOf, joinWithAnd } from '../../lib/text.js';
import type { ClassContents } from './classes-repository.js';

export function classDeletionBlocker(
  className: string,
  { studentCount, subjectCount }: ClassContents,
): string | undefined {
  const contents = [
    studentCount > 0 ? countOf(studentCount, 'student') : undefined,
    subjectCount > 0 ? countOf(subjectCount, 'subject') : undefined,
  ].filter((part) => part !== undefined);

  if (contents.length === 0) return undefined;
  return `${className} still has ${joinWithAnd(contents)}. Move or delete them first.`;
}
