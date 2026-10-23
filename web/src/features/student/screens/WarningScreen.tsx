import type { StudentAttempt } from '@exam-room/shared';
import { Button } from '../../../components/Button';
import { StatusScreen } from './StatusScreen';

type WarningScreenProps = {
  attempt: StudentAttempt;
  onContinue: () => void;
};

export function WarningScreen({ attempt, onContinue }: WarningScreenProps) {
  const allowedExits = attempt.test.allowedExits;
  const exitsLeft = Math.max(0, allowedExits - attempt.exitsUsed);
  const consequence =
    attempt.test.leaveRule === 'finish'
      ? 'your test will be finished and you cannot come back'
      : 'your test will be locked';

  return (
    <StatusScreen
      tone="danger"
      title="You left the test"
      isOverlay
      actions={
        <Button variant="secondary" size="large" fullWidth onClick={onContinue} autoFocus>
          Continue
        </Button>
      }
    >
      <p>
        Exits used: {attempt.exitsUsed} of {allowedExits} allowed.
      </p>
      <p>
        {exitsLeft === 0
          ? `If you leave again, ${consequence}.`
          : `You can leave ${describeTimes(exitsLeft)} more. After that ${consequence}.`}
      </p>
      <p>The timer did not stop.</p>
    </StatusScreen>
  );
}

function describeTimes(count: number): string {
  return count === 1 ? '1 time' : `${count} times`;
}
