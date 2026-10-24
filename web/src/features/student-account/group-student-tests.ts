import type { StudentTestCard } from '@exam-room/shared';
import { compareNaturally } from '../../lib/natural-order';

export type StudentTestGroups = {
  now: StudentTestCard[];
  upcoming: StudentTestCard[];
  finished: StudentTestCard[];
};

const UNFINISHED_STATUSES = new Set(['waiting', 'in_progress', 'locked']);

export function groupStudentTests(tests: readonly StudentTestCard[]): StudentTestGroups {
  const now = tests.filter(isHappeningNow);
  const upcoming = tests
    .filter((test) => test.attemptStatus === null && test.availability === 'scheduled')
    .sort((first, second) => (first.opensAt ?? 0) - (second.opensAt ?? 0));
  const finished = tests
    .filter((test) => isFinished(test))
    .sort((first, second) => (second.opensAt ?? 0) - (first.opensAt ?? 0));
  return { now: now.sort(byTitle), upcoming, finished };
}

function isHappeningNow(test: StudentTestCard): boolean {
  if (test.attemptStatus !== null) return UNFINISHED_STATUSES.has(test.attemptStatus);
  return test.availability === 'open';
}

function isFinished(test: StudentTestCard): boolean {
  if (test.attemptStatus !== null) return !UNFINISHED_STATUSES.has(test.attemptStatus);
  return test.availability === 'closed';
}

function byTitle(first: StudentTestCard, second: StudentTestCard): number {
  return compareNaturally(first.title, second.title);
}

export function studentTestPath(test: StudentTestCard): string {
  return test.releasedMarks === null ? `/t/${test.code}` : `/results/${test.code}`;
}

export type StudentTestTone = 'open' | 'active' | 'danger' | 'result' | 'quiet';

export function studentTestTone(test: StudentTestCard): StudentTestTone {
  if (test.releasedMarks !== null) return 'result';
  if (test.attemptStatus === 'locked') return 'danger';
  if (test.attemptStatus === 'waiting' || test.attemptStatus === 'in_progress') return 'active';
  if (test.attemptStatus === null && test.availability === 'open') return 'open';
  return 'quiet';
}

export function describeStudentTestState(test: StudentTestCard): string {
  if (test.releasedMarks !== null) {
    return `Marks: ${test.releasedMarks} of ${test.maxMarks ?? 0} – tap to see`;
  }
  if (test.attemptStatus === 'waiting') return 'Waiting for your teacher – tap to open';
  if (test.attemptStatus === 'in_progress') return 'Started – tap to continue';
  if (test.attemptStatus === 'locked') return 'Locked – ask your teacher';
  if (test.attemptStatus === 'submitted') {
    return test.finishReason === 'time_up' ? 'Finished – time up' : 'Finished';
  }
  if (test.availability === 'open') return 'Open now';
  if (test.availability === 'closed') return 'Missed';
  return 'Not open yet';
}
