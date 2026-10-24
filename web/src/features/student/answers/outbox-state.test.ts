import { describe, expect, it } from 'vitest';
import {
  emptyOutbox,
  hasUnsentWork,
  nextBatch,
  retryDelayMs,
  withAnswer,
  withSentBatch,
  withServerAnswers,
} from './outbox-state';

const choose = (choice: number) => ({ choice, text: null });

describe('the answer outbox', () => {
  it('keeps only the newest unsent answer per question, in order', () => {
    let outbox = emptyOutbox('K7M2QX', 'token');
    outbox = withAnswer(outbox, 'q1', choose(0), 100);
    outbox = withAnswer(outbox, 'q2', choose(1), 200);
    outbox = withAnswer(outbox, 'q1', choose(2), 300);

    expect(nextBatch(outbox, 10)).toEqual([
      { questionId: 'q1', choice: 2, text: null, sequence: 3, answeredAt: 300 },
      { questionId: 'q2', choice: 1, text: null, sequence: 2, answeredAt: 200 },
    ]);
    expect(nextBatch(outbox, 1)).toHaveLength(1);
  });

  it('forgets a sent answer, unless it changed while it was on the way', () => {
    let outbox = withAnswer(emptyOutbox('K7M2QX', 'token'), 'q1', choose(0), 100);
    outbox = withAnswer(outbox, 'q2', choose(1), 100);
    const batch = nextBatch(outbox, 10);
    outbox = withAnswer(outbox, 'q2', choose(3), 150);

    outbox = withSentBatch(outbox, batch, 1);
    expect(Object.keys(outbox.unsentSequences)).toEqual(['q2']);
    expect(outbox.tooLateCount).toBe(1);
    expect(hasUnsentWork(outbox)).toBe(true);
    outbox = withSentBatch(outbox, nextBatch(outbox, 10), 0);
    expect(hasUnsentWork(outbox)).toBe(false);
    expect(hasUnsentWork({ ...outbox, finishRequested: true })).toBe(true);
  });

  it('takes newer answers from the server and continues their sequence', () => {
    let outbox = withAnswer(emptyOutbox('K7M2QX', 'token'), 'q1', choose(0), 100);
    outbox = withServerAnswers(
      outbox,
      [
        { questionId: 'q1', choice: 3, text: null, sequence: 7 },
        { questionId: 'q2', choice: null, text: 'Saved earlier', sequence: 4 },
      ],
      500,
    );
    expect(outbox.answers.q1?.choice).toBe(3);
    expect(outbox.answers.q2?.text).toBe('Saved earlier');
    expect(withAnswer(outbox, 'q1', choose(1), 600).answers.q1?.sequence).toBe(8);
  });

  it('waits longer after every failure, at most a minute, with some randomness', () => {
    expect(retryDelayMs(1, 0)).toBe(500);
    expect(retryDelayMs(1, 1)).toBe(1000);
    expect(retryDelayMs(3, 1)).toBe(4000);
    expect(retryDelayMs(20, 1)).toBe(60_000);
    expect(retryDelayMs(20, 0)).toBe(30_000);
  });
});
