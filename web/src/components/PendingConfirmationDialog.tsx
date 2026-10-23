import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

export type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  onConfirm: () => Promise<unknown>;
};

type PendingConfirmationDialogProps = {
  confirmation: Confirmation;
  onClose: () => void;
};

export function PendingConfirmationDialog({
  confirmation,
  onClose,
}: PendingConfirmationDialogProps) {
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function confirm(): Promise<void> {
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      await confirmation.onConfirm();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
      setIsBusy(false);
    }
  }

  return (
    <ConfirmDialog
      title={confirmation.title}
      message={confirmation.message}
      confirmLabel={confirmation.confirmLabel}
      busyLabel={confirmation.busyLabel}
      isBusy={isBusy}
      errorMessage={errorMessage}
      onCancel={onClose}
      onConfirm={() => void confirm()}
    />
  );
}
