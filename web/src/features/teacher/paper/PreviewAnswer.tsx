import type { MarkableUnit, QuestionAnswer } from '@exam-room/shared';
import { checksAutomatically } from '@exam-room/shared/paper-rules';
import { RichText } from '../../paper/RichText';
import styles from './PreviewAnswer.module.css';

type PreviewUnitAnswerProps = {
  unit: MarkableUnit;
  answer: QuestionAnswer | undefined;
};

export function PreviewUnitAnswer({ unit, answer }: PreviewUnitAnswerProps) {
  if (unit.kind === 'mcq') return null;
  if (unit.kind === 'short' && answer?.accepted?.length) {
    return (
      <p className={styles.rightAnswer} dir="auto">
        ✓ {answer.accepted.join('  |  ')}
      </p>
    );
  }
  if (unit.kind === 'blanks' && checksAutomatically(unit, answer)) {
    return <p className={styles.note}>The app checks each blank.</p>;
  }
  return (
    <div className={styles.note}>
      {answer?.text ? (
        <details>
          <summary>Model answer · you or the AI give the marks</summary>
          <div dir="auto" className={styles.modelAnswer}>
            <RichText text={answer.text} />
          </div>
        </details>
      ) : (
        'No answer given · you or the AI give the marks'
      )}
    </div>
  );
}

export function PreviewBlank({ accepted }: { accepted: readonly string[] | undefined }) {
  return (
    <span className={accepted ? styles.filledBlank : styles.emptyBlank} dir="auto">
      {accepted?.join(' | ') ?? ''}
    </span>
  );
}
