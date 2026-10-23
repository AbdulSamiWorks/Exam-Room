import { Button } from '../../../components/Button';
import { StatusScreen } from './StatusScreen';

export function SessionLostScreen({ onOpenAgain }: { onOpenAgain: () => void }) {
  return (
    <StatusScreen
      tone="neutral"
      title="Test opened somewhere else"
      actions={
        <Button size="large" fullWidth onClick={onOpenAgain}>
          Open the test here
        </Button>
      }
    >
      <p>This test is now open on another phone or browser.</p>
      <p>You can open it here again, but this counts as leaving the test.</p>
    </StatusScreen>
  );
}
