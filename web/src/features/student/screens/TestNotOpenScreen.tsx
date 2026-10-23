import type { PublicTest } from '@exam-room/shared';
import { Button } from '../../../components/Button';
import { describeDateTime } from '../../../lib/describe-date-time';
import { StatusScreen } from './StatusScreen';

type TestNotOpenScreenProps = {
  test: PublicTest;
  onAlreadyStarted: () => void;
};

export function TestNotOpenScreen({ test, onAlreadyStarted }: TestNotOpenScreenProps) {
  const testName = `${test.title} · ${test.subjectName}`;

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
    <StatusScreen tone="neutral" title="Not open yet">
      <p>{testName}</p>
      <p>
        {test.availability === 'scheduled'
          ? `This test opens ${describeDateTime(test.opensAt)}.`
          : 'Your teacher has not opened this test yet.'}
      </p>
      <p>Keep this page open. It checks again by itself every few seconds.</p>
    </StatusScreen>
  );
}
