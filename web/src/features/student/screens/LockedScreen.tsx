import { StatusScreen } from './StatusScreen';

export function LockedScreen() {
  return (
    <StatusScreen tone="danger" title="Test locked">
      <p>You left the test too many times, so it is locked.</p>
      <p>Tell your teacher. If your teacher unlocks it, the paper will open here again.</p>
    </StatusScreen>
  );
}
