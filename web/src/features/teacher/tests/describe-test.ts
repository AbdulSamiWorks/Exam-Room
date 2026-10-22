import type { AllowedExits } from '@exam-room/shared';

const MINUTES_PER_HOUR = 60;

export function describeAllowedExits(allowedExits: AllowedExits): string {
  if (allowedExits === 0) return 'No exits allowed';
  return allowedExits === 1 ? '1 exit allowed' : `${allowedExits} exits allowed`;
}

export function describeDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / MINUTES_PER_HOUR);
  const minutes = durationMinutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function describePageCount(pageCount: number): string {
  return pageCount === 1 ? '1 page' : `${pageCount} pages`;
}

export function studentTestLink(testCode: string): string {
  return `${window.location.origin}/t/${testCode}`;
}
