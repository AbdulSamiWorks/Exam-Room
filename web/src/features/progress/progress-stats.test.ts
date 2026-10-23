import type { ProgressResult } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import {
  chapterSummaries,
  percentOf,
  scoreTimeline,
  subjectSummaries,
  summarizeProgress,
  trendOf,
} from './progress-stats';

function result(overrides: Partial<ProgressResult>): ProgressResult {
  return {
    testCode: 'K7M2QX',
    testTitle: 'Quiz',
    kind: 'test',
    subjectId: 1,
    subjectName: 'Physics',
    chapters: [],
    date: 0,
    marks: 5,
    maxMarks: 10,
    isReleased: true,
    ...overrides,
  };
}

const PHYSICS = {
  id: 1,
  name: 'Physics',
  chapters: [
    { id: 7, name: 'Motion' },
    { id: 8, name: 'Force' },
  ],
};
const MATH = { id: 2, name: 'Math', chapters: [] };

describe('progress statistics', () => {
  it('turns marks into rounded percentages and a timeline by date', () => {
    expect(percentOf({ marks: 2, maxMarks: 3 })).toBe(67);
    expect(percentOf({ marks: 0, maxMarks: 0 })).toBe(0);
    expect(
      scoreTimeline([result({ date: 20, marks: 10 }), result({ date: 10, testTitle: 'First' })]),
    ).toEqual([
      { date: 10, percent: 50, label: 'First' },
      { date: 20, percent: 100, label: 'Quiz' },
    ]);
  });

  it('finds the average, the best subject and how many tests are done', () => {
    const results = [
      result({ marks: 8 }),
      result({ marks: 6 }),
      result({ subjectId: 2, subjectName: 'Math', marks: 9 }),
    ];
    expect(summarizeProgress(results, [PHYSICS, MATH])).toEqual({
      testsDone: 3,
      averagePercent: 77,
      bestSubject: { subjectId: 2, name: 'Math', averagePercent: 90, testsDone: 1 },
      trend: undefined,
    });
    expect(subjectSummaries([], [PHYSICS])).toEqual([
      { subjectId: 1, name: 'Physics', averagePercent: null, testsDone: 0 },
    ]);
  });

  it('compares the last three results with the three before', () => {
    const marks = (values: number[]) =>
      values.map((value, index) => result({ marks: value, date: index }));
    expect(trendOf(marks([5, 5, 5, 7, 7, 7]))).toBe('up');
    expect(trendOf(marks([7, 7, 7, 5, 5, 5]))).toBe('down');
    expect(trendOf(marks([5, 6, 5, 6, 5, 5]))).toBe('steady');
    expect(trendOf(marks([5, 6]))).toBeUndefined();
  });

  it('shows progress per chapter from the tests tagged with it', () => {
    const results = [
      result({ marks: 8, chapters: [{ id: 7, name: 'Motion' }] }),
      result({
        marks: 4,
        chapters: [
          { id: 7, name: 'Motion' },
          { id: 8, name: 'Force' },
        ],
      }),
    ];
    expect(chapterSummaries(results, PHYSICS.chapters)).toEqual([
      { chapterId: 7, name: 'Motion', averagePercent: 60, testsDone: 2 },
      { chapterId: 8, name: 'Force', averagePercent: 40, testsDone: 1 },
    ]);
  });
});
