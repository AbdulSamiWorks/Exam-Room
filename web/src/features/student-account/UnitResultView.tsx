import type { MarkableUnit, UnitResult } from '@exam-room/shared';
import { classNames } from '../../lib/class-names';
import { describeMarks, formatMarks } from '../../lib/describe-marks';
import { RichText } from '../paper/RichText';
import styles from './UnitResultView.module.css';

type UnitResultViewProps = {
  unit: MarkableUnit;
  result: UnitResult;
  isFinal: boolean;
};

export function UnitResultView({ unit, result, isFinal }: UnitResultViewProps) {
  const showsTypedAnswer = unit.kind === 'short' || unit.kind === 'written';
  return (
    <div className={styles.unitResult}>
      {showsTypedAnswer && result.typedAnswer && (
        <p className={classNames(styles.typedAnswer, answerTone(result.isCorrect))} dir="auto">
          {result.isCorrect !== null && (result.isCorrect ? '✓ ' : '✗ ')}
          {result.typedAnswer}
        </p>
      )}
      {unit.kind === 'short' && !result.isCorrect && result.correctAnswers.length > 0 && (
        <p className={styles.rightAnswer} dir="auto">
          Right answer: {result.correctAnswers.join(' | ')}
        </p>
      )}
      <p className={styles.marks}>{describeMarksOf(unit, result, isFinal)}</p>
      {result.modelAnswer && (
        <div className={styles.modelAnswer}>
          <p className={styles.modelAnswerTitle}>Model answer</p>
          <div dir="auto">
            <RichText text={result.modelAnswer} />
          </div>
        </div>
      )}
      {result.comment && (
        <p className={styles.comment} dir="auto">
          {result.comment}
        </p>
      )}
    </div>
  );
}

function describeMarksOf(unit: MarkableUnit, result: UnitResult, isFinal: boolean): string {
  if (result.marks === null) return isFinal ? 'Not marked' : 'Marked later by your teacher';
  return `${formatMarks(result.marks)} of ${describeMarks(unit.marks)}`;
}

function answerTone(isCorrect: boolean | null): string | undefined {
  if (isCorrect === null) return undefined;
  return isCorrect ? styles.right : styles.wrong;
}

type ResultBlankProps = {
  result: UnitResult;
  blankIndex: number;
};

export function ResultBlank({ result, blankIndex }: ResultBlankProps) {
  const answer = result.blankAnswers[blankIndex]?.trim() ?? '';
  const isRight = result.blankResults[blankIndex];
  const rightAnswer = result.correctAnswers[blankIndex];
  return (
    <span className={styles.blankResult}>
      <span className={classNames(styles.blankAnswer, answerTone(isRight ?? null))} dir="auto">
        {isRight !== undefined && (isRight ? '✓ ' : '✗ ')}
        {answer || '—'}
      </span>
      {isRight === false && rightAnswer && (
        <span className={styles.blankRightAnswer} dir="auto">
          {rightAnswer}
        </span>
      )}
    </span>
  );
}
