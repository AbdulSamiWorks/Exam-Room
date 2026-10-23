import type { PublicTest, WrittenAnswers } from '@exam-room/shared';

const TYPED_WRITTEN_ANSWERS: ReadonlySet<WrittenAnswers> = new Set(['typed', 'typed_and_photos']);

export function takesTypedWrittenAnswers(writtenAnswers: WrittenAnswers): boolean {
  return TYPED_WRITTEN_ANSWERS.has(writtenAnswers);
}

export function describeHowToAnswer(test: PublicTest): string {
  if (test.questionCount === 0) return 'Answer on your own paper. When you are done, tap Finish.';
  const written = takesTypedWrittenAnswers(test.writtenAnswers)
    ? 'type written answers in the boxes'
    : 'write the written answers on your own paper';
  const where = test.paperKind === 'pages' ? ' on the answer sheet' : '';
  return `Tap the multiple choice answers${where} and ${written}. Every answer is saved on your phone at once and sent automatically, also when the internet is slow. When you are done, tap Finish.`;
}
