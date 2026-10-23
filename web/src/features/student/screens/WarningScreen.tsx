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
          ? 'If you leave again, your test will be locked.'
          : `You can leave ${describeTimes(exitsLeft)} more. After that your test will be locked.`}
      </p>
      <p>The timer did not stop.</p>
    </StatusScreen>
  );
}

function describeTimes(count: number): string {
  return count === 1 ? '1 time' : `${count} times`;
}
