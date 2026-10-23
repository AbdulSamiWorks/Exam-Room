import type { AttemptResult } from '@exam-room/shared';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const clockTimeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export type ResultTone = 'active' | 'success' | 'danger';

export type ResultStatus = {
  label: string;
  tone: ResultTone;
};

export function describeResultStatus(result: AttemptResult): ResultStatus {
  if (result.status === 'locked') return { label: 'Left the test', tone: 'danger' };
  if (result.status === 'submitted') {
    return result.finishReason === 'time_up'
      ? { label: 'Time up', tone: 'success' }
      : { label: 'Submitted', tone: 'success' };
  }
  return result.isAwayNow
    ? { label: 'Away now', tone: 'danger' }
    : { label: 'In progress', tone: 'active' };
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
