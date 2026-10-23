import type { TestSummary } from '@exam-room/shared';

export type TestRecord = Omit<TestSummary, 'availability'>;
