import type { TestSummary } from '@exam-room/shared';
import { describeDateTime } from '../../../lib/describe-date-time';

export type AvailabilityTone = 'open' | 'waiting' | 'closed';

export type AvailabilityStatus = {
  label: string;
  tone: AvailabilityTone;
};

export function describeAvailabilityStatus(test: TestSummary): AvailabilityStatus {
  switch (test.availability) {
    case 'open':
      return { label: 'Open', tone: 'open' };
    case 'scheduled':
      return { label: 'Opens later', tone: 'waiting' };
    case 'closed':
      return { label: 'Closed', tone: 'closed' };
    case 'not_open':
      return { label: 'Not open', tone: 'closed' };
  }
}

export function describeAvailability(test: TestSummary): string {
  switch (test.availability) {
    case 'open':
      return test.closesAt === null
        ? 'Students can start now.'
        : `Students can start until ${describeDateTime(test.closesAt)}.`;
    case 'scheduled':
      return test.closesAt === null
        ? `Opens ${describeDateTime(test.opensAt)}.`
        : `Opens ${describeDateTime(test.opensAt)} and closes ${describeDateTime(test.closesAt)}.`;
    case 'closed':
      return `Closed ${describeDateTime(test.closesAt)}. New students cannot start.`;
    case 'not_open':
      return 'Students cannot start yet. Open it when the exam begins, or set the times.';
  }
}
