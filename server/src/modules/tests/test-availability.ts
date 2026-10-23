import type { TestAvailability, TestSchedule, TestSummary } from '@exam-room/shared';
import type { TestWithChapters } from './test-record.js';

export const NOT_OPEN_SCHEDULE: TestSchedule = { opensAt: null, closesAt: null };

export function availabilityAt(schedule: TestSchedule, currentTime: number): TestAvailability {
  if (schedule.opensAt === null) return 'not_open';
  if (currentTime < schedule.opensAt) return 'scheduled';
  if (schedule.closesAt !== null && currentTime >= schedule.closesAt) return 'closed';
  return 'open';
}

export function openNow(schedule: TestSchedule, currentTime: number): TestSchedule {
  if (availabilityAt(schedule, currentTime) === 'open') return schedule;
  const closesLater = schedule.closesAt !== null && schedule.closesAt > currentTime;
  return { opensAt: currentTime, closesAt: closesLater ? schedule.closesAt : null };
}

export function closeNow(schedule: TestSchedule, currentTime: number): TestSchedule {
  const availability = availabilityAt(schedule, currentTime);
  if (availability === 'open') return { opensAt: schedule.opensAt, closesAt: currentTime };
  if (availability === 'scheduled') return NOT_OPEN_SCHEDULE;
  return schedule;
}

export function summarizeTest(test: TestWithChapters, currentTime: number): TestSummary {
  return { ...test, availability: availabilityAt(test, currentTime) };
}
