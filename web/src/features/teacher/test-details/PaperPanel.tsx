import type { TestSummary } from '@exam-room/shared';
import { ButtonLink } from '../../../components/Button';
import { Panel } from '../../../components/Panel';
import { describeMarks } from '../../../lib/describe-marks';
import { countOf } from '../../../lib/text';
import styles from './TestDetailsPage.module.css';

export function PaperPanel({ test }: { test: TestSummary }) {
  const paperPath = `/teacher/tests/${test.id}/paper`;
  const hasQuestions = test.questionCount > 0;
  const questionSummary = hasQuestions
    ? `${countOf(test.questionCount, 'question')} · ${describeMarks(test.maxMarks ?? 0)}`
    : undefined;

  if (test.paperKind === 'typed') {
    return (
      <Panel title="Questions">
        <p className={styles.note}>{questionSummary}</p>
        <ButtonLink to={paperPath} variant="secondary">
          Questions and answers
        </ButtonLink>
      </Panel>
    );
  }

  return (
    <Panel title="Answer sheet">
      <p className={styles.note}>
        {questionSummary ??
          'No answer sheet yet. Add one so students tap their MCQ answers and the app marks them.'}
      </p>
      <ButtonLink to={paperPath} variant="secondary">
        {hasQuestions ? 'Answer sheet and answers' : 'Add an answer sheet'}
      </ButtonLink>
    </Panel>
  );
}
