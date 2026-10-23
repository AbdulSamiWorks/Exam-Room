import type { TestLimits } from '@exam-room/shared';

export const testLimits: TestLimits = {
  maxTitleLength: 120,
  minDurationMinutes: 1,
  maxDurationMinutes: 600,
  maxPages: 30,
  maxPageImageBytes: 3_000_000,
  maxChaptersPerTest: 20,
  maxBountyNoteLength: 200,
  maxBountyPoints: 1000,
  maxOfflineMarks: 1000,
};
