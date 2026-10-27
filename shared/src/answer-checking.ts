import type { StoredAnswer } from './answers.js';
import type { MarkableUnit, QuestionAnswer } from './paper.js';
import { blankCountOf, blankSlotId, checksAutomatically } from './paper-rules.js';

const CURLY_APOSTROPHES = /[‘’ʼ`´]/g;
const CURLY_QUOTES = /[“”]/g;
const DOTS_INSIDE_SHORT_FORMS = /(\p{L})\.(?=\p{L})/gu;
const NOT_WORD_CHARACTERS = /[^\p{L}\p{M}\p{N}'\s]/gu;
const LONE_APOSTROPHES = /(^|\s)'+|'+(\s|$)/g;
const SPACES = /\s+/g;

const SHORT_FORMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bshan't\b/g, 'shall not'],
  [/\bcan not\b/g, 'cannot'],
  [/n't\b/g, ' not'],
  [/\bi'm\b/g, 'i am'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
];

export function normalizeAnswer(answer: string): string {
  let normalized = answer
    .normalize('NFC')
    .toLowerCase()
    .replace(CURLY_APOSTROPHES, "'")
    .replace(CURLY_QUOTES, ' ')
    .replace(DOTS_INSIDE_SHORT_FORMS, '$1')
    .replace(NOT_WORD_CHARACTERS, ' ')
    .replace(SPACES, ' ');
  for (const [shortForm, longForm] of SHORT_FORMS) {
    normalized = normalized.replace(shortForm, longForm);
  }
  return normalized.replace(LONE_APOSTROPHES, '$1$2').replace(SPACES, ' ').trim();
}

export function isAcceptedAnswer(answer: string | null | undefined, accepted: readonly string[]) {
  const normalized = normalizeAnswer(answer ?? '');
  return normalized !== '' && accepted.some((right) => normalizeAnswer(right) === normalized);
}

export function checkBlanks(
  answers: ReadonlyArray<string | null | undefined>,
  acceptedPerBlank: ReadonlyArray<readonly string[]>,
): boolean[] {
  return acceptedPerBlank.map((accepted, blankIndex) =>
    isAcceptedAnswer(answers[blankIndex], accepted),
  );
}

export type UnitCheck = {
  marks: number;
  isCorrect: boolean;
  blankResults: boolean[];
};

export type GivenAnswer = Pick<StoredAnswer, 'choice' | 'text'>;

const MARKS_PRECISION = 100;

export function checkUnit(
  unit: Pick<MarkableUnit, 'id' | 'kind' | 'text' | 'marks'>,
  key: QuestionAnswer | undefined,
  answers: ReadonlyMap<string, GivenAnswer>,
): UnitCheck | undefined {
  if (!checksAutomatically(unit, key)) return undefined;
  if (unit.kind === 'blanks') {
    const blankAnswers = Array.from(
      { length: blankCountOf(unit.text) },
      (_blank, blankIndex) => answers.get(blankSlotId(unit.id, blankIndex))?.text,
    );
    const blankResults = checkBlanks(blankAnswers, key?.blanks ?? []);
    const rightCount = blankResults.filter(Boolean).length;
    return {
      marks:
        Math.round((unit.marks * rightCount * MARKS_PRECISION) / blankResults.length) /
        MARKS_PRECISION,
      isCorrect: rightCount === blankResults.length,
      blankResults,
    };
  }
  const answer = answers.get(unit.id);
  const isCorrect =
    unit.kind === 'mcq'
      ? key?.option !== undefined && answer?.choice === key.option
      : isAcceptedAnswer(answer?.text, key?.accepted ?? []);
  return { marks: isCorrect ? unit.marks : 0, isCorrect, blankResults: [] };
}
