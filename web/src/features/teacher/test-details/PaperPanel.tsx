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

  const markingLink = hasQuestions && (
    <ButtonLink to={`/teacher/tests/${test.id}/marking`}>
      {test.resultsReleasedAt === null ? 'Marks and release' : 'Marks (released)'}
    </ButtonLink>
  );

  if (test.paperKind === 'none') {
    return (
      <Panel title="Offline assignment">
        <p className={styles.note}>
          Done on paper, out of {describeMarks(test.maxMarks ?? 0)}. Type the marks of each student
          here.
        </p>
        <ButtonLink to={`/teacher/tests/${test.id}/offline-marks`}>
          {test.resultsReleasedAt === null ? 'Enter marks and release' : 'Marks (released)'}
        </ButtonLink>
      </Panel>
    );
  }

  if (test.paperKind === 'typed') {
    return (
      <Panel title="Questions">
        <p className={styles.note}>{questionSummary}</p>
        <div className={styles.actions}>
          <ButtonLink to={paperPath} variant="secondary">
            Questions and answers
          </ButtonLink>
          {markingLink}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Answer sheet">
      <p className={styles.note}>
        {questionSummary ??
          'No answer sheet yet. Add one so students tap their MCQ answers and the app marks them.'}
      </p>
      <div className={styles.actions}>
        <ButtonLink to={paperPath} variant="secondary">
          {hasQuestions ? 'Answer sheet and answers' : 'Add an answer sheet'}
        </ButtonLink>
        {markingLink}
      </div>
    </Panel>
  );
}
