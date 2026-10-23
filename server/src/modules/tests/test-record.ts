import type { ChapterTag, TestSummary } from '@exam-room/shared';

export type TestRecord = Omit<TestSummary, 'availability' | 'chapters'>;

export type TestWithChapters = TestRecord & {
  chapters: ChapterTag[];
};
