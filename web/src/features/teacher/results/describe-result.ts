import type { AttemptExit, AttemptResult, ExitReason } from '@exam-room/shared';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const clockTimeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export type ResultTone = 'active' | 'success' | 'danger';

export type ResultStatus = {
  label: string;
  tone: ResultTone;
};

const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  hidden: 'Left the page',
  blur: 'Switched away',
  fullscreen: 'Left fullscreen',
  device_change: 'Opened on another phone',
};

export function describeResultStatus(result: AttemptResult): ResultStatus {
  if (result.status === 'locked') return { label: 'Left the test', tone: 'danger' };
  if (result.status === 'submitted') return describeFinishedStatus(result);
  return result.isAwayNow
    ? { label: 'Away now', tone: 'danger' }
    : { label: 'In progress', tone: 'active' };
}

function describeFinishedStatus(result: AttemptResult): ResultStatus {
  switch (result.finishReason) {
    case 'time_up':
      return { label: 'Time up', tone: 'success' };
    case 'teacher':
      return { label: 'Ended by you', tone: 'success' };
    case 'left_test':
      return { label: 'Left · finished', tone: 'danger' };
    default:
      return { label: 'Submitted', tone: 'success' };
  }
}

export function sortByRollNumber(results: readonly AttemptResult[]): AttemptResult[] {
  return [...results].sort((first, second) =>
    first.rollNumber.localeCompare(second.rollNumber, undefined, { numeric: true }),
  );
}

export function isStoppedForLeaving(result: AttemptResult): boolean {
  return result.status === 'locked' || result.finishReason === 'left_test';
}

export function describeExitReason(reason: ExitReason): string {
  return EXIT_REASON_LABELS[reason];
}

export function describeExitPeriod(exit: AttemptExit): string {
  const returnTime = exit.returnedAt === null ? 'still away' : describeClockTime(exit.returnedAt);
  return `${describeClockTime(exit.leftAt)} → ${returnTime}`;
}

export function describeClockTime(timestamp: number | null): string {
  return timestamp === null ? '—' : clockTimeFormat.format(timestamp);
}

export function describeAwayTime(awayMs: number): string {
  const totalSeconds = Math.round(awayMs / MILLISECONDS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (minutes === 0) return `${seconds} s`;
  return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
}

export function describeExits(result: AttemptResult): string {
  const exits = result.exitCount === 1 ? '1 exit' : `${result.exitCount} exits`;
  return result.forgivenExits > 0 ? `${exits} (${result.forgivenExits} forgiven)` : exits;
}
