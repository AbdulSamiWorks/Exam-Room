import { useParams } from 'react-router';
import { ButtonLink } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { describeDuration, describePageCount } from '../../../lib/describe-test-length';
import { describeAllowedExits } from '../tests/describe-test';
import { ResultsPanel } from '../results/ResultsPanel';
import { useTest } from '../tests/use-tests';
import { DeleteTestPanel } from './DeleteTestPanel';
import { ShareTestPanel } from './ShareTestPanel';
import { TestAvailabilityPanel } from './TestAvailabilityPanel';
import styles from './TestDetailsPage.module.css';

const BACK_TO_TESTS = { to: '/teacher', label: 'All tests' };

export function TestDetailsPage() {
  const testId = Number(useParams().testId);
  const testQuery = useTest(testId);

  if (testQuery.isPending) return <LoadingScreen />;

  if (testQuery.isError) {
    return (
      <Page title="Test" backLink={BACK_TO_TESTS}>
        <FormError>{testQuery.error.message}</FormError>
      </Page>
    );
  }

  const test = testQuery.data;
  const subtitle = [
    test.subject.name,
    describePageCount(test.pageCount),
    describeDuration(test.durationMinutes),
    describeAllowedExits(test.allowedExits),
  ].join(' · ');

  return (
    <Page
      title={test.title}
      subtitle={subtitle}
      backLink={BACK_TO_TESTS}
      actions={
        <ButtonLink variant="secondary" to={`/teacher/tests/${test.id}/edit`}>
          Edit
        </ButtonLink>
      }
    >
      <div className={styles.sections}>
        <TestAvailabilityPanel test={test} />
        <ShareTestPanel test={test} />
        <ResultsPanel testId={test.id} />
        <DeleteTestPanel test={test} />
      </div>
    </Page>
  );
}
