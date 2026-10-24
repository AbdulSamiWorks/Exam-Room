import type { AllowedExits, ChapterTag } from '@exam-room/shared';
import { describeChapterNames } from '../../../lib/describe-test-kind';

const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

export function describeAllowedExits(allowedExits: AllowedExits): string {
  if (allowedExits === 0) return 'No exits allowed';
  return allowedExits === 1 ? '1 exit allowed' : `${allowedExits} exits allowed`;
}

export function describeCreatedDate(createdAt: number): string {
  return `Created ${shortDateFormat.format(createdAt)}`;
}

export function studentTestLink(testCode: string): string {
  return `${window.location.origin}/t/${testCode}`;
}

export function describeChapters(chapters: readonly ChapterTag[]): string | undefined {
  return describeChapterNames(chapters.map((chapter) => chapter.name));
}
