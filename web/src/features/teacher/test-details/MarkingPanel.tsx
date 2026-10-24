import type { TestSummary } from '@exam-room/shared';
import { ButtonLink } from '../../../components/Button';
import { Panel } from '../../../components/Panel';
import { testMarkingPath, testPaperPath } from '../tests/test-paths';
import styles from './TestDetailsPage.module.css';

export function MarkingPanel({ test }: { test: TestSummary }) {
  if (test.studentCount === 0 || test.paperKind === 'none') return null;

  if (test.questionCount === 0) {
    return (
      <Panel title="Marks and results">
        <p className={styles.note}>
          To give marks, add an answer sheet: the app marks the MCQs, and you mark the short and
          long questions next to the students' answer photos.
        </p>
        <ButtonLink to={testPaperPath(test.id)}>Add an answer sheet</ButtonLink>
      </Panel>
    );
  }

  const isReleased = test.resultsReleasedAt !== null;
  return (
    <Panel title="Marks and results">
      <p className={styles.note}>
        {test.finishedCount} {test.finishedCount === 1 ? 'student has' : 'students have'} finished.{' '}
        {isReleased
          ? 'The results are released; changes you make are shown to students at once.'
          : 'Mark the short and long answers, then release the results.'}
      </p>
      <ButtonLink to={testMarkingPath(test.id)} size="large" fullWidth>
        {isReleased ? 'See and change marks' : 'Mark answers'}
      </ButtonLink>
    </Panel>
  );
}
