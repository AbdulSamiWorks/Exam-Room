import { checkBlanks, isAcceptedAnswer, normalizeAnswer } from '@exam-room/shared/answer-checking';
import { describe, expect, it } from 'vitest';

describe('exact answer checking', () => {
  it('ignores capitals, spaces and punctuation', () => {
    expect(normalizeAnswer('  The plane   will land at 6 p.m.? ')).toBe(
      'the plane will land at 6 pm',
    );
    expect(
      isAcceptedAnswer('Will the plane land at 6 pm', ['Will the plane land at 6 p.m.?']),
    ).toBe(true);
    expect(
      isAcceptedAnswer('the shopkeeper does not sell fresh fruit', [
        'The shopkeeper does not sell fresh fruit.',
      ]),
    ).toBe(true);
  });

  it('counts short forms the same as long forms', () => {
    expect(
      isAcceptedAnswer("He doesn't like cold weather.", ['He does not like cold weather.']),
    ).toBe(true);
    expect(isAcceptedAnswer('I won’t make it.', ['I will not make it.'])).toBe(true);
    expect(isAcceptedAnswer("She can't swim.", ['She can not swim.'])).toBe(true);
    expect(
      isAcceptedAnswer("They're late and I'm sure we've lost.", [
        'They are late and I am sure we have lost.',
      ]),
    ).toBe(true);
    expect(isAcceptedAnswer("He'll come.", ['He will come.'])).toBe(true);
  });

  it('keeps words that change the meaning', () => {
    expect(
      isAcceptedAnswer('He did not like cold weather.', ['He does not like cold weather.']),
    ).toBe(false);
    expect(isAcceptedAnswer("He's gone.", ['He has gone.'])).toBe(false);
    expect(isAcceptedAnswer('', ['anything'])).toBe(false);
    expect(isAcceptedAnswer('...', ['...'])).toBe(false);
  });

  it('accepts any of several right answers', () => {
    expect(
      isAcceptedAnswer('present continuous tense', [
        'Present continuous',
        'Present continuous tense',
      ]),
    ).toBe(true);
  });

  it('reads Urdu without its full stop', () => {
    expect(isAcceptedAnswer('وہ اسکول گیا۔', ['وہ اسکول گیا'])).toBe(true);
  });

  it('checks each blank on its own', () => {
    expect(
      checkBlanks(
        ['had run', ' Is knocking ', null],
        [['had run'], ['is knocking'], ['has worked']],
      ),
    ).toEqual([true, true, false]);
  });
});
