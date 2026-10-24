import type { Paper, PaperQuestion } from '@exam-room/shared';

export type StudentPaperView = {
  paper: Paper;
  optionOrders: ReadonlyMap<string, readonly number[]>;
};

const FIXED_PLACE_OPTION = /\b(all|none|both|neither)\b.*\b(of|above|these|them|options?)\b/i;
const UINT32_RANGE = 4294967296;

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export function shuffled<Item>(items: readonly Item[], random: () => number): Item[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex] as Item, result[index] as Item];
  }
  return result;
}

function keepsOptionOrder(question: PaperQuestion): boolean {
  return (
    question.kind !== 'mcq' || question.options.some((option) => FIXED_PLACE_OPTION.test(option))
  );
}

export function studentPaperView(paper: Paper, shuffleSeed: number | null): StudentPaperView {
  if (shuffleSeed === null) return { paper, optionOrders: new Map() };
  const random = seededRandom(shuffleSeed);
  const optionOrders = new Map<string, number[]>();
  const sections = paper.sections.map((section) => ({
    ...section,
    questions: shuffled(section.questions, random).map((question) => {
      if (keepsOptionOrder(question)) return question;
      const order = shuffled(
        question.options.map((_option, optionIndex) => optionIndex),
        random,
      );
      optionOrders.set(question.id, order);
      return {
        ...question,
        options: order.map((optionIndex) => question.options[optionIndex] ?? ''),
      };
    }),
  }));
  return { paper: { ...paper, sections }, optionOrders };
}

export function originalOptionOf(
  view: StudentPaperView,
  questionId: string,
  shownOption: number,
): number {
  return view.optionOrders.get(questionId)?.[shownOption] ?? shownOption;
}

export function shownOptionOf(
  view: StudentPaperView,
  questionId: string,
  originalOption: number,
): number {
  const order = view.optionOrders.get(questionId);
  return order ? order.indexOf(originalOption) : originalOption;
}
