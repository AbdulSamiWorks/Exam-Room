import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import styles from './FinishDialog.module.css';

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
    <div className={styles.backdrop}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="finish-dialog-title"
      >
        <h2 id="finish-dialog-title" className={styles.title}>
          Finish the test?
        </h2>
        <p className={styles.message}>After you finish, you cannot open the paper again.</p>
        {errorMessage && <FormError>{errorMessage}</FormError>}
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel} disabled={isFinishing} autoFocus>
            Keep working
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isFinishing}>
            {isFinishing ? 'Finishing…' : 'Finish test'}
          </Button>
        </div>
      </div>
    </div>
  );
}
