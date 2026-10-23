import type { ChapterTag, ProgressResult, ProgressSubject } from '@exam-room/shared';

export type Trend = 'up' | 'down' | 'steady';

export type ProgressSummary = {
  testsDone: number;
  averagePercent: number | null;
  bestSubject: SubjectSummary | undefined;
  trend: Trend | undefined;
};

export type SubjectSummary = {
  subjectId: number;
  name: string;
  averagePercent: number | null;
  testsDone: number;
};

export type ChapterSummary = {
  chapterId: number;
  name: string;
  averagePercent: number | null;
  testsDone: number;
};

export type ScorePoint = {
  date: number;
  percent: number;
  label: string;
};

const TREND_WINDOW = 3;
const TREND_THRESHOLD = 5;

export function percentOf(result: Pick<ProgressResult, 'marks' | 'maxMarks'>): number {
  return result.maxMarks > 0 ? Math.round((result.marks / result.maxMarks) * 100) : 0;
}

export function averagePercentOf(results: readonly ProgressResult[]): number | null {
  if (results.length === 0) return null;
  const total = results.reduce((sum, result) => sum + percentOf(result), 0);
  return Math.round(total / results.length);
}

export function scoreTimeline(results: readonly ProgressResult[]): ScorePoint[] {
  return [...results]
    .sort((first, second) => first.date - second.date)
    .map((result) => ({ date: result.date, percent: percentOf(result), label: result.testTitle }));
}

export function trendOf(results: readonly ProgressResult[]): Trend | undefined {
  const timeline = scoreTimeline(results);
  if (timeline.length < TREND_WINDOW * 2) return undefined;
  const recent = timeline.slice(-TREND_WINDOW);
  const before = timeline.slice(-TREND_WINDOW * 2, -TREND_WINDOW);
  const difference = meanPercent(recent) - meanPercent(before);
  if (difference >= TREND_THRESHOLD) return 'up';
  if (difference <= -TREND_THRESHOLD) return 'down';
  return 'steady';
}

export function subjectSummaries(
  results: readonly ProgressResult[],
  subjects: readonly ProgressSubject[],
): SubjectSummary[] {
  const names = new Map(subjects.map((subject) => [subject.id, subject.name]));
  for (const result of results) {
    if (!names.has(result.subjectId)) names.set(result.subjectId, result.subjectName);
  }
  return [...names].map(([subjectId, name]) => {
    const subjectResults = results.filter((result) => result.subjectId === subjectId);
    return {
      subjectId,
      name,
      averagePercent: averagePercentOf(subjectResults),
      testsDone: subjectResults.length,
    };
  });
}

export function chapterSummaries(
  results: readonly ProgressResult[],
  chapters: readonly ChapterTag[],
): ChapterSummary[] {
  return chapters.map((chapter) => {
    const chapterResults = results.filter((result) =>
      result.chapters.some((tag) => tag.id === chapter.id),
    );
    return {
      chapterId: chapter.id,
      name: chapter.name,
      averagePercent: averagePercentOf(chapterResults),
      testsDone: chapterResults.length,
    };
  });
}

export function summarizeProgress(
  results: readonly ProgressResult[],
  subjects: readonly ProgressSubject[],
): ProgressSummary {
  const rankedSubjects = subjectSummaries(results, subjects)
    .filter((subject) => subject.averagePercent !== null)
    .sort((first, second) => (second.averagePercent ?? 0) - (first.averagePercent ?? 0));
  return {
    testsDone: results.length,
    averagePercent: averagePercentOf(results),
    bestSubject: rankedSubjects[0],
    trend: trendOf(results),
  };
}

function meanPercent(points: readonly ScorePoint[]): number {
  return points.reduce((sum, point) => sum + point.percent, 0) / points.length;
}
