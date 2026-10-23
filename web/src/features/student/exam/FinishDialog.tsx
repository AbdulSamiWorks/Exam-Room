import { ConfirmDialog } from '../../../components/ConfirmDialog';

type FinishDialogProps = {
  isFinishing: boolean;
  isOffline: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const OFFLINE_MESSAGE =
  'No internet right now. Your answers and Finish are saved on this phone and are sent by themselves as soon as the internet is back. Keep this page open, or open the app again later.';

export function FinishDialog({ isFinishing, isOffline, onCancel, onConfirm }: FinishDialogProps) {
  return (
    <ConfirmDialog
      title={isFinishing ? 'Finishing your test' : 'Finish the test?'}
      message={
        isFinishing && isOffline
          ? OFFLINE_MESSAGE
          : 'After you finish, you cannot open the paper again.'
      }
      confirmLabel="Finish test"
      busyLabel={isOffline ? 'Waiting for internet…' : 'Sending your answers…'}
      cancelLabel="Keep working"
      isBusy={isFinishing}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
