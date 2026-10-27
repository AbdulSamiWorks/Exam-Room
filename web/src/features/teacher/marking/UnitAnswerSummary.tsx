import type { MarkableUnit, QuestionAnswer, StoredAnswer } from '@exam-room/shared';
import type { UnitCheck } from '@exam-room/shared/answer-checking';
import { blankSlotId, blankCountOf, optionLetter } from '@exam-room/shared/paper-rules';
import styles from './MarkingPage.module.css';

type UnitAnswerSummaryProps = {
  unit: MarkableUnit;
  answerKey: QuestionAnswer | undefined;
  answers: ReadonlyMap<string, StoredAnswer>;
  check: UnitCheck | undefined;
};

export function UnitAnswerSummary({ unit, answerKey, answers, check }: UnitAnswerSummaryProps) {
  if (unit.kind === 'mcq') {
    const choice = answers.get(unit.id)?.choice ?? null;
    const correctOption = answerKey?.option;
    return (
      <p className={styles.answerLine}>
        Chose <strong>{choice === null ? 'nothing' : optionLetter(choice)}</strong>
        {correctOption !== undefined && ` · correct is ${optionLetter(correctOption)}`}
        {check?.isCorrect ? ' ✓' : ''}
      </p>
    );
  }
  if (unit.kind === 'blanks') {
    return (
      <ol className={styles.blankList}>
        {Array.from({ length: blankCountOf(unit.text) }, (_blank, blankIndex) => {
          const given = answers.get(blankSlotId(unit.id, blankIndex))?.text?.trim() ?? '';
          const isRight = check?.blankResults[blankIndex];
          const rightAnswers = answerKey?.blanks?.[blankIndex];
          return (
            <li key={blankIndex} dir="auto">
              <strong>{given || '—'}</strong>
              {isRight !== undefined && (isRight ? ' ✓' : ' ✗')}
              {isRight === false && rightAnswers && ` · right: ${rightAnswers.join(' | ')}`}
            </li>
          );
        })}
      </ol>
    );
  }
  const typed = answers.get(unit.id)?.text?.trim();
  return (
    <>
      <p className={styles.typedAnswer} dir="auto">
        {typed || 'No typed answer (see the photos or the paper).'}
        {check && (check.isCorrect ? ' ✓' : ' ✗')}
      </p>
      {check && !check.isCorrect && answerKey?.accepted && (
        <p className={styles.answerLine} dir="auto">
          Right: {answerKey.accepted.join(' | ')}
        </p>
      )}
    </>
  );
}
