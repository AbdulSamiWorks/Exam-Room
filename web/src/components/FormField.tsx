import type { ReactNode } from 'react';
import { errorIdFor, hintIdFor, type FieldMessages } from './form-field-accessibility';
import styles from './FormField.module.css';

type FormFieldProps = FieldMessages & {
  label: string;
  controlId: string;
  children: ReactNode;
};

export function FormField({ label, controlId, hint, errorMessage, children }: FormFieldProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={controlId} className={styles.label}>
        {label}
      </label>
      {hint && (
        <p id={hintIdFor(controlId)} className={styles.hint}>
          {hint}
        </p>
      )}
      {children}
      {errorMessage && (
        <p id={errorIdFor(controlId)} className={styles.errorMessage}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
