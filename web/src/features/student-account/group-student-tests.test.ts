import type { StudentTestCard } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import { describeStudentTestState, groupStudentTests } from './group-student-tests';

function card(overrides: Partial<StudentTestCard>): StudentTestCard {
  return {
    code: 'K7M2QX',
    title: 'Quiz',
    kind: 'test',
    subjectName: 'Physics',
    durationMinutes: 30,
    availability: 'open',
    opensAt: 0,
    closesAt: null,
    attemptStatus: null,
    finishReason: null,
    ...overrides,
  };
}

describe('groupStudentTests', () => {
  it('puts open and unfinished tests now, scheduled ones by opening time, the rest finished', () => {
    const groups = groupStudentTests([
      card({ code: 'A', title: 'B quiz' }),
      card({ code: 'B', title: 'A quiz', availability: 'closed', attemptStatus: 'locked' }),
      card({ code: 'C', availability: 'scheduled', opensAt: 300 }),
      card({ code: 'D', availability: 'scheduled', opensAt: 200 }),
      card({ code: 'E', attemptStatus: 'submitted', opensAt: 10 }),
      card({ code: 'F', availability: 'closed', opensAt: 20 }),
      card({ code: 'G', availability: 'not_open', opensAt: null }),
    ]);

    expect(groups.now.map((test) => test.code)).toEqual(['B', 'A']);
    expect(groups.upcoming.map((test) => test.code)).toEqual(['D', 'C']);
    expect(groups.finished.map((test) => test.code)).toEqual(['F', 'E']);
  });
});

describe('describeStudentTestState', () => {
  it('says what the student can do', () => {
    expect(describeStudentTestState(card({}))).toBe('Open now');
    expect(describeStudentTestState(card({ attemptStatus: 'in_progress' }))).toBe(
      'Started – tap to continue',
    );
    expect(describeStudentTestState(card({ attemptStatus: 'locked' }))).toBe(
      'Locked – ask your teacher',
    );
    expect(
      describeStudentTestState(card({ attemptStatus: 'submitted', finishReason: 'time_up' })),
    ).toBe('Finished – time up');
    expect(describeStudentTestState(card({ availability: 'closed' }))).toBe('Missed');
  });
});
