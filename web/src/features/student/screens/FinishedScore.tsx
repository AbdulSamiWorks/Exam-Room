import { ButtonLink } from '../../../components/Button';
import { describeScore } from '../../../lib/describe-marks';
import { AnswerCounts } from '../../student-account/AnswerCounts';
import { automaticSummary, checksOnlyMultipleChoice } from '../../student-account/result-summary';
import { studentResultPath } from '../../student-account/student-paths';
import { useStudentResult } from '../../student-account/use-student-result';
import styles from './FinishedScore.module.css';

export function FinishedScore({ testCode }: { testCode: string }) {
  const resultQuery = useStudentResult(testCode);
  const resultPath = studentResultPath(testCode);

  if (resultQuery.isPending) {
    return <p className={styles.label}>Working out your score…</p>;
  }
  if (resultQuery.isError) {
    return (
      <ButtonLink to={resultPath} size="large" fullWidth>
        See my result
      </ButtonLink>
    );
  }

  const result = resultQuery.data;
  return (
    <div className={styles.scoreBox}>
      <p className={styles.label}>
        {checksOnlyMultipleChoice(result)
          ? 'Your multiple choice score'
          : 'Your score for the answers the app checks'}
      </p>
      <p className={styles.score}>{describeScore(result.totalMarks, result.maxMarks)}</p>
      <AnswerCounts summary={automaticSummary(result.units)} />
      <ButtonLink to={resultPath} size="large" fullWidth>
        See which answers were right
      </ButtonLink>
    </div>
  );
}
