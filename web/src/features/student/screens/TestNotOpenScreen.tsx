import type { PublicTestDetails } from '@exam-room/shared';
import { Button } from '../../../components/Button';
import { describeDateTime } from '../../../lib/describe-date-time';
import { describeTestHeading } from '../join/describe-test-heading';
import { StatusScreen } from './StatusScreen';

type TestNotOpenScreenProps = {
  test: PublicTestDetails;
  onAlreadyStarted: () => void;
};

export function TestNotOpenScreen({ test, onAlreadyStarted }: TestNotOpenScreenProps) {
  const testName = `${test.title} · ${describeTestHeading(test)}`;

  if (test.availability === 'closed') {
    return (
      <StatusScreen
        tone="neutral"
        title="This test is closed"
        actions={
          <Button variant="secondary" size="large" fullWidth onClick={onAlreadyStarted}>
            I already started this test
          </Button>
        }
      >
        <p>{testName}</p>
        <p>New students cannot start it any more. Ask your teacher if this is a mistake.</p>
      </StatusScreen>
    );
  }

  return (
    <StatusScreen
      tone="neutral"
      title={test.availability === 'scheduled' ? 'Coming soon' : 'Not open yet'}
    >
      <p>{testName}</p>
      <p>
        {test.availability === 'scheduled' ? (
          <>
            This test opens <strong>{describeDateTime(test.opensAt)}</strong>.
          </>
        ) : (
          'Your teacher has not opened this test yet. It opens when your teacher starts it.'
        )}
      </p>
      <p>Keep this page open. It opens by itself when the test starts.</p>
    </StatusScreen>
  );
}
