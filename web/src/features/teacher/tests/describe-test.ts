import type { AllowedExits } from '@exam-room/shared';

const shortDateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

export function describeAllowedExits(allowedExits: AllowedExits): string {
  if (allowedExits === 0) return 'No exits allowed';
  return allowedExits === 1 ? '1 exit allowed' : `${allowedExits} exits allowed`;
}

export function describeStudentCount(studentCount: number): string {
  if (studentCount === 0) return 'No students yet';
  return studentCount === 1 ? '1 student' : `${studentCount} students`;
}

export function describeCreatedDate(createdAt: number): string {
  return `Created ${shortDateFormat.format(createdAt)}`;
}

export function studentTestLink(testCode: string): string {
  return `${window.location.origin}/t/${testCode}`;
}
