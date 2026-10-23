import { ConfirmDialog } from '../../../components/ConfirmDialog';

type FinishDialogProps = {
  isFinishing: boolean;
  errorMessage: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
};

export function FinishDialog({
  isFinishing,
  errorMessage,
  onCancel,
  onConfirm,
}: FinishDialogProps) {
  return (
    <ConfirmDialog
      title="Finish the test?"
      message="After you finish, you cannot open the paper again."
      confirmLabel="Finish test"
      busyLabel="Finishing…"
      cancelLabel="Keep working"
      isBusy={isFinishing}
      errorMessage={errorMessage}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
