import type { StudentTestCard } from '@exam-room/shared';
import type { Notice } from '../../components/NoticeDialog';
import { describeDateTime } from '../../lib/describe-date-time';
import { formatMarks } from '../../lib/describe-marks';
import { compareNaturally } from '../../lib/natural-order';
import { studentResultPath } from './student-paths';

export type StudentTestGroups = {
  now: StudentTestCard[];
  upcoming: StudentTestCard[];
  finished: StudentTestCard[];
};

const UNFINISHED_STATUSES = new Set(['waiting', 'in_progress', 'locked']);

export function groupStudentTests(tests: readonly StudentTestCard[]): StudentTestGroups {
  const now = tests.filter(isHappeningNow);
  const upcoming = tests.filter(isComingUp).sort(byOpeningTime);
  const finished = tests
    .filter((test) => isFinished(test))
    .sort((first, second) => (second.opensAt ?? 0) - (first.opensAt ?? 0));
  return { now: now.sort(byTitle), upcoming, finished };
}

export function isComingUp(test: StudentTestCard): boolean {
  if (test.attemptStatus !== null) return false;
  return test.availability === 'scheduled' || test.availability === 'not_open';
}

export function notOpenNotice(test: StudentTestCard): Notice {
  if (test.availability === 'scheduled') {
    return {
      title: 'Coming soon',
      message: `${test.title} opens ${describeDateTime(test.opensAt)}. Come back then.`,
    };
  }
  return {
    title: 'Not open yet',
    message: `${test.title} is not open yet. Come back when your teacher opens it.`,
  };
}

function byOpeningTime(first: StudentTestCard, second: StudentTestCard): number {
  const firstOpensAt = first.availability === 'scheduled' ? (first.opensAt ?? 0) : Infinity;
  const secondOpensAt = second.availability === 'scheduled' ? (second.opensAt ?? 0) : Infinity;
  if (firstOpensAt === secondOpensAt) return byTitle(first, second);
  return firstOpensAt < secondOpensAt ? -1 : 1;
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
  const hasResult = test.releasedMarks !== null || test.hasInstantResult;
  return hasResult ? studentResultPath(test.code) : `/t/${test.code}`;
}

export type StudentTestTone =
  'action' | 'wait' | 'danger' | 'good' | 'okay' | 'low' | 'result' | 'quiet';

export type StudentTestPill = {
  label: string;
  tone: StudentTestTone;
};

const GOOD_PERCENT = 70;
const OKAY_PERCENT = 40;

function scoreTone(marks: number, maxMarks: number | null): StudentTestTone {
  if (!maxMarks) return 'result';
  const percent = (marks / maxMarks) * 100;
  if (percent >= GOOD_PERCENT) return 'good';
  return percent >= OKAY_PERCENT ? 'okay' : 'low';
}

export function studentTestPill(test: StudentTestCard): StudentTestPill {
  if (test.releasedMarks !== null) {
    return {
      label: `${formatMarks(test.releasedMarks)} / ${formatMarks(test.maxMarks ?? 0)}`,
      tone: scoreTone(test.releasedMarks, test.maxMarks),
    };
  }
  if (test.hasInstantResult) return { label: 'Result so far', tone: 'result' };
  switch (test.attemptStatus) {
    case 'waiting':
      return { label: 'Waiting', tone: 'wait' };
    case 'in_progress':
      return { label: 'Continue', tone: 'action' };
    case 'locked':
      return { label: 'Locked', tone: 'danger' };
    case 'submitted':
      return { label: 'Marking', tone: 'quiet' };
    case null:
      break;
  }
  if (test.availability === 'open') return { label: 'Start', tone: 'action' };
  if (test.availability === 'closed') return { label: 'Missed', tone: 'quiet' };
  return { label: 'Soon', tone: 'wait' };
}
