import type { StudentTestCard } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import { groupStudentTests, studentTestPill } from './group-student-tests';

function card(overrides: Partial<StudentTestCard>): StudentTestCard {
  return {
    code: 'K7M2QX',
    title: 'Quiz',
    kind: 'test',
    subjectId: 1,
    subjectName: 'Physics',
    durationMinutes: 30,
    availability: 'open',
    opensAt: 0,
    closesAt: null,
    attemptStatus: null,
    finishReason: null,
    maxMarks: null,
    releasedMarks: null,
    hasMcqResult: false,
    chapterNames: [],
    bountyNote: '',
    bountyPoints: 0,
    ...overrides,
  };
}

describe('groupStudentTests', () => {
  it('puts open and unfinished tests now, coming ones by opening time, the rest finished', () => {
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
    expect(groups.upcoming.map((test) => test.code)).toEqual(['D', 'C', 'G']);
    expect(groups.finished.map((test) => test.code)).toEqual(['F', 'E']);
  });
});

describe('studentTestPill', () => {
  it('says what the student can do with a test', () => {
    expect(studentTestPill(card({}))).toEqual({ label: 'Start', tone: 'action' });
    expect(studentTestPill(card({ attemptStatus: 'in_progress' }))).toEqual({
      label: 'Continue',
      tone: 'action',
    });
    expect(studentTestPill(card({ attemptStatus: 'waiting' })).tone).toBe('wait');
    expect(studentTestPill(card({ attemptStatus: 'locked' })).tone).toBe('danger');
    expect(studentTestPill(card({ attemptStatus: 'submitted' })).label).toBe('Marking');
    expect(studentTestPill(card({ availability: 'closed' })).label).toBe('Missed');
    expect(studentTestPill(card({ availability: 'scheduled' })).label).toBe('Soon');
    expect(studentTestPill(card({ availability: 'not_open' })).label).toBe('Soon');
  });

  it('shows the score with a colour for how good it is', () => {
    const finished = { attemptStatus: 'submitted' as const, maxMarks: 20 };
    expect(studentTestPill(card({ ...finished, releasedMarks: 17 }))).toEqual({
      label: '17 / 20',
      tone: 'good',
    });
    expect(studentTestPill(card({ ...finished, releasedMarks: 9.5 })).tone).toBe('okay');
    expect(studentTestPill(card({ ...finished, releasedMarks: 4 })).tone).toBe('low');
    expect(studentTestPill(card({ ...finished, hasMcqResult: true })).label).toBe('MCQ result');
  });
});
