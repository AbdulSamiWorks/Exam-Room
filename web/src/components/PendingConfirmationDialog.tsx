import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { TextField } from './TextField';

export type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  typedConfirmation?: string;
  onConfirm: () => Promise<unknown>;
};

function sameText(first: string, second: string): boolean {
  return first.trim().toLowerCase() === second.trim().toLowerCase();
}

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
  const [typedText, setTypedText] = useState('');
  const { typedConfirmation } = confirmation;
  const isTypedTextMissing =
    typedConfirmation !== undefined && !sameText(typedText, typedConfirmation);

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
      isConfirmDisabled={isTypedTextMissing}
      onCancel={onClose}
      onConfirm={() => void confirm()}
    >
      {typedConfirmation !== undefined && (
        <TextField
          label={`Type ${typedConfirmation} to confirm`}
          value={typedText}
          autoComplete="off"
          onChange={(event) => setTypedText(event.target.value)}
        />
      )}
    </ConfirmDialog>
  );
}
