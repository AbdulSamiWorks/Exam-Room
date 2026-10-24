import { ButtonLink } from '../../../components/Button';
import { describeScore } from '../../../lib/describe-marks';
import { MultipleChoiceCounts } from '../../student-account/MultipleChoiceCounts';
import { multipleChoiceSummary } from '../../student-account/result-summary';
import { studentResultPath } from '../../student-account/student-paths';
import { useStudentResult } from '../../student-account/use-student-result';
import styles from './FinishedMcqScore.module.css';

export function FinishedMcqScore({ testCode }: { testCode: string }) {
  const resultQuery = useStudentResult(testCode);
  const resultPath = studentResultPath(testCode);

  if (resultQuery.isPending) {
    return <p className={styles.label}>Working out your score…</p>;
  }
  if (resultQuery.isError) {
    return (
      <ButtonLink to={resultPath} size="large" fullWidth>
        See my MCQ result
      </ButtonLink>
    );
  }

  const result = resultQuery.data;
  return (
    <div className={styles.scoreBox}>
      <p className={styles.label}>Your multiple choice score</p>
      <p className={styles.score}>{describeScore(result.totalMarks, result.maxMarks)}</p>
      <MultipleChoiceCounts summary={multipleChoiceSummary(result)} />
      <ButtonLink to={resultPath} size="large" fullWidth>
        See which answers were right
      </ButtonLink>
    </div>
  );
}
