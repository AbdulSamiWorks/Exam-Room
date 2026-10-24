import type { TestKind } from '@exam-room/shared';

const TEST_KIND_LABELS: Record<TestKind, string> = {
  test: 'Test',
  quiz: 'Quiz',
  assignment: 'Assignment',
};

export function describeTestKind(kind: TestKind): string {
  return TEST_KIND_LABELS[kind];
}

export function describeChapterNames(chapterNames: readonly string[]): string | undefined {
  if (chapterNames.length === 0) return undefined;
  const label = chapterNames.length === 1 ? 'Chapter' : 'Chapters';
  return `${label}: ${chapterNames.join(', ')}`;
}
