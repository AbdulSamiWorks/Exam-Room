import { useId } from 'react';
import { Button } from './Button';
import { FormError } from './FormError';
import styles from './ConfirmDialog.module.css';

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  cancelLabel?: string;
  isBusy: boolean;
  errorMessage?: string;
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
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();

  return (
    <div className={styles.backdrop}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>
        {errorMessage && <FormError>{errorMessage}</FormError>}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel} disabled={isBusy} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isBusy}>
            {isBusy ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
