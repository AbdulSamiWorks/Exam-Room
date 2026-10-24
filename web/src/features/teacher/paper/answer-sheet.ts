import type { AnswerKey, Paper, PaperQuestion } from '@exam-room/shared';
import { optionIndexOf, optionLetter, questionsOf } from '@exam-room/shared/paper-rules';
import { questionIdFor } from './imported-paper';

export type AnswerSheetPlan = {
  mcqCount: number;
  optionCount: number;
  mcqMarks: number;
  writtenCount: number;
  writtenMarks: number;
};

const ANSWER_TOKENS = /[a-f?]/gi;
const SKIPPED_ANSWER = '?';

export function buildAnswerSheet(plan: AnswerSheetPlan): Paper {
  const optionLabels = Array.from({ length: plan.optionCount }, (_, index) => optionLetter(index));
  const mcqs = Array.from({ length: plan.mcqCount }, (_, index) =>
    sheetQuestion(index, 'mcq', plan.mcqMarks, optionLabels),
  );
  const writtenQuestions = Array.from({ length: plan.writtenCount }, (_, index) =>
    sheetQuestion(plan.mcqCount + index, 'written', plan.writtenMarks, []),
  );

  return {
    instructions: '',
    sections: [
      { title: 'Multiple choice', instructions: '', questions: mcqs },
      { title: 'Written answers', instructions: '', questions: writtenQuestions },
    ].filter((section) => section.questions.length > 0),
  };
}

function sheetQuestion(
  questionIndex: number,
  kind: PaperQuestion['kind'],
  marks: number,
  options: string[],
): PaperQuestion {
  return {
    id: questionIdFor(questionIndex),
    kind,
    text: `Question ${questionIndex + 1}`,
    marks,
    options,
    imageNumber: null,
  };
}

export function answerSheetPlanOf(paper: Paper): AnswerSheetPlan {
  const questions = questionsOf(paper);
  const mcqs = questions.filter((question) => question.kind === 'mcq');
  const writtenQuestions = questions.filter((question) => question.kind === 'written');
  return {
    mcqCount: mcqs.length,
    optionCount: mcqs[0]?.options.length ?? 4,
    mcqMarks: mcqs[0]?.marks ?? 1,
    writtenCount: writtenQuestions.length,
    writtenMarks: writtenQuestions[0]?.marks ?? 5,
  };
}

export type LetterAnswers = {
  answerKey: AnswerKey;
  problem: string | undefined;
};

export function answerKeyFromLetters(paper: Paper, letters: string): LetterAnswers {
  const mcqs = questionsOf(paper).filter((question) => question.kind === 'mcq');
  const typedLetters = letters.match(ANSWER_TOKENS) ?? [];
  const answerKey: AnswerKey = {};

  for (const [index, letter] of typedLetters.slice(0, mcqs.length).entries()) {
    if (letter === SKIPPED_ANSWER) continue;
    const question = mcqs[index];
    const option = optionIndexOf(letter);
    if (!question || option === undefined || option >= question.options.length) {
      return {
        answerKey: {},
        problem: `Answer ${index + 1} (${letter.toUpperCase()}) is not an option.`,
      };
    }
    answerKey[question.id] = { option };
  }

  const problem =
    typedLetters.length > mcqs.length
      ? `There are ${typedLetters.length} letters but only ${mcqs.length} questions.`
      : undefined;
  return { answerKey, problem };
}

export function lettersOfAnswerKey(paper: Paper, answerKey: AnswerKey): string {
  return questionsOf(paper)
    .filter((question) => question.kind === 'mcq')
    .map((question) => {
      const option = answerKey[question.id]?.option;
      return option === undefined ? SKIPPED_ANSWER : optionLetter(option);
    })
    .join('');
}

export function withChosenOptions(answerKey: AnswerKey, chosenOptions: AnswerKey): AnswerKey {
  const withoutOptions = Object.entries(answerKey).flatMap(([questionId, answer]) =>
    answer.text ? [[questionId, { text: answer.text }] as const] : [],
  );
  const merged: AnswerKey = Object.fromEntries(withoutOptions);
  for (const [questionId, { option }] of Object.entries(chosenOptions)) {
    if (option !== undefined) merged[questionId] = { ...merged[questionId], option };
  }
  return merged;
}
