import { useParams } from 'react-router';
import { ButtonLink } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { describeBounty } from '../../../lib/describe-bounty';
import { describeDuration, describePaperSize } from '../../../lib/describe-test-length';
import { describeAllowedExits, describeChapters, describeTestKind } from '../tests/describe-test';
import { ResultsPanel } from '../results/ResultsPanel';
import { useTest } from '../tests/use-tests';
import { DeleteTestPanel } from './DeleteTestPanel';
import { PaperPanel } from './PaperPanel';
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
    describeTestKind(test.kind),
    `${test.schoolClass.name} · ${test.subject.name}`,
    describeChapters(test.chapters),
    describePaperSize(test),
    test.kind === 'assignment' ? 'No timer' : describeDuration(test.durationMinutes),
    test.kind === 'assignment' ? undefined : describeAllowedExits(test.allowedExits),
    describeBounty(test.bountyNote, test.bountyPoints),
  ]
    .filter(Boolean)
    .join(' · ');

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
        {test.paperKind !== 'none' && <ShareTestPanel test={test} />}
        <PaperPanel test={test} />
        <ResultsPanel test={test} />
        <DeleteTestPanel test={test} />
      </div>
    </Page>
  );
}
