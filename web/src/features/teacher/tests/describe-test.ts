import type { AllowedExits, ChapterTag, TestKind } from '@exam-room/shared';

const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

export function describeAllowedExits(allowedExits: AllowedExits): string {
  if (allowedExits === 0) return 'No exits allowed';
  return allowedExits === 1 ? '1 exit allowed' : `${allowedExits} exits allowed`;
}

export function describeStudentCount(studentCount: number): string {
  if (studentCount === 0) return 'No students yet';
  return studentCount === 1 ? '1 student' : `${studentCount} students`;
}

export function describeCreatedDate(createdAt: number): string {
  return `Created ${shortDateFormat.format(createdAt)}`;
}

export function studentTestLink(testCode: string): string {
  return `${window.location.origin}/t/${testCode}`;
}

const TEST_KIND_LABELS: Record<TestKind, string> = {
  test: 'Test',
  quiz: 'Quiz',
  assignment: 'Assignment',
};

export function describeTestKind(kind: TestKind): string {
  return TEST_KIND_LABELS[kind];
}

export function describeChapters(chapters: readonly ChapterTag[]): string | undefined {
  if (chapters.length === 0) return undefined;
  const label = chapters.length === 1 ? 'Chapter' : 'Chapters';
  return `${label}: ${chapters.map((chapter) => chapter.name).join(', ')}`;
}
