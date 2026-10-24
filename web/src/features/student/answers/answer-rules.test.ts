import type { PublicTest } from '@exam-room/shared';
import { describe, expect, it } from 'vitest';
import { describeHowToAnswer } from './answer-rules';

function publicTest(overrides: Partial<PublicTest>): PublicTest {
  return {
    code: 'K7M2QX',
    kind: 'test',
    title: 'Quiz',
    subjectName: 'Physics',
    durationMinutes: 30,
    allowedExits: 1,
    leaveRule: 'lock',
    paperKind: 'typed',
    pageCount: 0,
    questionCount: 10,
    maxMarks: 10,
    writtenAnswers: 'typed',
    bountyNote: '',
    bountyPoints: 0,
    waitingRoom: false,
    instantMcqResult: false,
    opensAt: null,
    closesAt: null,
    availability: 'open',
    ...overrides,
  };
}

describe('describeHowToAnswer', () => {
  it('explains where each kind of answer goes', () => {
    expect(describeHowToAnswer(publicTest({ questionCount: 0, paperKind: 'pages' }))).toBe(
      'Answer on your own paper. When you are done, tap Finish.',
    );
    expect(describeHowToAnswer(publicTest({}))).toContain('type written answers in the boxes');
    expect(
      describeHowToAnswer(publicTest({ paperKind: 'pages', writtenAnswers: 'on_paper' })),
    ).toContain('on the answer sheet and write the written answers on your own paper');
  });
});
