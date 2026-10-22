import { useId, type InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  errorMessage?: string;
};

export function TextField({ label, errorMessage, id, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorMessageId = `${inputId}-error`;
  const hasError = Boolean(errorMessage);

  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorMessageId : undefined}
        {...inputProps}
      />
      {hasError && (
        <p id={errorMessageId} className={styles.errorMessage}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
