import { Button } from '../../../components/Button';
import { StatusScreen } from './StatusScreen';

type ErrorScreenProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorScreen({
  title = 'Something went wrong',
  message,
  onRetry,
}: ErrorScreenProps) {
  return (
    <StatusScreen
      tone="neutral"
      title={title}
      actions={
        onRetry && (
          <Button variant="secondary" size="large" fullWidth onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      <p>{message}</p>
    </StatusScreen>
  );
}
