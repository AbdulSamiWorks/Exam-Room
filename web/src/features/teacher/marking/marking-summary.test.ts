import type { AttemptMarking } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import { describeMarkingProgress, unmarkedStudentCount } from './marking-summary';

function marking(markedWrittenCount: number, writtenCount: number): AttemptMarking {
  return {
    attemptId: 1,
    studentName: 'Ayesha',
    rollNumber: '1',
    status: 'submitted',
    finishReason: 'student',
    answers: [],
    questionMarks: {},
    comment: '',
    photoCount: 0,
    score: {
      mcqMarks: 0,
      writtenMarks: 0,
      totalMarks: 0,
      correctCount: 0,
      mcqCount: 0,
      markedWrittenCount,
      writtenCount,
    },
  };
}

describe('marking summary', () => {
  it('says how far the marking is', () => {
    expect(describeMarkingProgress(marking(0, 0))).toBe('Marked automatically');
    expect(describeMarkingProgress(marking(1, 2))).toBe('1 of 2 written answers marked');
    expect(describeMarkingProgress(marking(2, 2))).toBe('Marked');
    expect(describeMarkingProgress({ ...marking(0, 2), photoCount: 3 })).toBe(
      '0 of 2 written answers marked · 3 photos',
    );
    expect(unmarkedStudentCount([marking(1, 2), marking(2, 2)])).toBe(1);
  });
});
