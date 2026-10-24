import type { ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  cancelLabel?: string;
  isBusy: boolean;
  errorMessage?: string;
  isConfirmDisabled?: boolean;
  children?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busyLabel,
  cancelLabel = 'Cancel',
  isBusy,
  errorMessage,
  isConfirmDisabled = false,
  children,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      message={message}
      errorMessage={errorMessage}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isBusy} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isBusy || isConfirmDisabled}>
            {isBusy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
