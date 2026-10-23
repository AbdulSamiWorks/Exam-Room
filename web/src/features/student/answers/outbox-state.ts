import type { AnswerChange, StoredAnswer } from '@exam-room/shared';

export type LocalAnswer = {
  choice: number | null;
  text: string | null;
  sequence: number;
  answeredAt: number;
};

export type AttemptOutbox = {
  testCode: string;
  attemptToken: string;
  answers: Record<string, LocalAnswer>;
  unsentSequences: Record<string, number>;
  finishRequested: boolean;
  finishSent: boolean;
  lastSequence: number;
  tooLateCount: number;
};

export type AnswerValue = Pick<LocalAnswer, 'choice' | 'text'>;

const FIRST_RETRY_DELAY_MS = 1000;
const LONGEST_RETRY_DELAY_MS = 60_000;

export function emptyOutbox(testCode: string, attemptToken: string): AttemptOutbox {
  return {
    testCode,
    attemptToken,
    answers: {},
    unsentSequences: {},
    finishRequested: false,
    finishSent: false,
    lastSequence: 0,
    tooLateCount: 0,
  };
}

export function withAnswer(
  outbox: AttemptOutbox,
  questionId: string,
  value: AnswerValue,
  answeredAt: number,
): AttemptOutbox {
  const sequence = outbox.lastSequence + 1;
  return {
    ...outbox,
    answers: { ...outbox.answers, [questionId]: { ...value, sequence, answeredAt } },
    unsentSequences: { ...outbox.unsentSequences, [questionId]: sequence },
    lastSequence: sequence,
  };
}

export function withServerAnswers(
  outbox: AttemptOutbox,
  serverAnswers: readonly StoredAnswer[],
  serverTime: number,
): AttemptOutbox {
  const answers = { ...outbox.answers };
  let lastSequence = outbox.lastSequence;
  for (const serverAnswer of serverAnswers) {
    lastSequence = Math.max(lastSequence, serverAnswer.sequence);
    const localAnswer = answers[serverAnswer.questionId];
    if (!localAnswer || localAnswer.sequence < serverAnswer.sequence) {
      answers[serverAnswer.questionId] = {
        choice: serverAnswer.choice,
        text: serverAnswer.text,
        sequence: serverAnswer.sequence,
        answeredAt: serverTime,
      };
    }
  }
  return { ...outbox, answers, lastSequence };
}

export function nextBatch(outbox: AttemptOutbox, maxSize: number): AnswerChange[] {
  return Object.entries(outbox.unsentSequences)
    .slice(0, maxSize)
    .flatMap(([questionId]) => {
      const answer = outbox.answers[questionId];
      return answer
        ? [
            {
              questionId,
              choice: answer.choice,
              text: answer.text,
              sequence: answer.sequence,
              answeredAt: answer.answeredAt,
            },
          ]
        : [];
    });
}

export function withSentBatch(
  outbox: AttemptOutbox,
  batch: readonly AnswerChange[],
  tooLateCount: number,
): AttemptOutbox {
  const unsentSequences = { ...outbox.unsentSequences };
  for (const sent of batch) {
    if (unsentSequences[sent.questionId] === sent.sequence) delete unsentSequences[sent.questionId];
  }
  return { ...outbox, unsentSequences, tooLateCount: outbox.tooLateCount + tooLateCount };
}

export function hasUnsentWork(outbox: AttemptOutbox): boolean {
  return (
    Object.keys(outbox.unsentSequences).length > 0 || (outbox.finishRequested && !outbox.finishSent)
  );
}

export function chosenOptionsOf(outbox: AttemptOutbox): Record<string, number | undefined> {
  return Object.fromEntries(
    Object.entries(outbox.answers).map(([questionId, answer]) => [
      questionId,
      answer.choice ?? undefined,
    ]),
  );
}

export function retryDelayMs(failureCount: number, random: number): number {
  const exponentialDelay = FIRST_RETRY_DELAY_MS * 2 ** Math.max(0, failureCount - 1);
  const cappedDelay = Math.min(LONGEST_RETRY_DELAY_MS, exponentialDelay);
  return Math.round(cappedDelay / 2 + (cappedDelay / 2) * random);
}
