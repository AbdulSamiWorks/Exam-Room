import { Button } from '../../../components/Button';
import { StatusScreen } from './StatusScreen';

export function SessionLostScreen({ onOpenAgain }: { onOpenAgain: () => void }) {
  return (
    <StatusScreen
      tone="neutral"
      title="Test closed on this phone"
      actions={
        <Button size="large" fullWidth onClick={onOpenAgain}>
          Open the test here
        </Button>
      }
    >
      <p>The test was opened on another phone or browser, or your teacher removed your start.</p>
      <p>You can open it here again. If your test is still running, this counts as leaving it.</p>
    </StatusScreen>
  );
}
