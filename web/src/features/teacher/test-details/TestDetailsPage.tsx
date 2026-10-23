import { useParams } from 'react-router';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { describeDuration, describePageCount } from '../../../lib/describe-test-length';
import { describeAllowedExits } from '../tests/describe-test';
import { useTest } from '../tests/use-tests';
import { ShareTestPanel } from './ShareTestPanel';
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
    <Page title={test.title} subtitle={subtitle} backLink={BACK_TO_TESTS}>
      <div className={styles.sections}>
        <ShareTestPanel test={test} />
        <Panel title="Results">
          <p className={styles.emptyResults}>Students who start the test will appear here.</p>
        </Panel>
      </div>
    </Page>
  );
}
