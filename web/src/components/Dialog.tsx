import { useId, type ReactNode } from 'react';
import { FormError } from './FormError';
import styles from './Dialog.module.css';

type DialogProps = {
  title: string;
  message: string;
  errorMessage?: string;
  actions: ReactNode;
  children?: ReactNode;
};

export function Dialog({ title, message, errorMessage, actions, children }: DialogProps) {
  const titleId = useId();
  const messageId = useId();

  return (
    <div className={styles.backdrop}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p id={messageId} className={styles.message}>
          {message}
        </p>
        {children}
        {errorMessage && <FormError>{errorMessage}</FormError>}
        <div className={styles.actions}>{actions}</div>
      </div>
    </div>
  );
}
