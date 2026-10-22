import { useId, type InputHTMLAttributes } from 'react';
import { fieldAccessibilityProps, type FieldMessages } from './form-field-accessibility';
import { FormField } from './FormField';
import styles from './FormField.module.css';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> &
  FieldMessages & {
    label: string;
  };

export function TextField({ label, hint, errorMessage, id, ...inputProps }: TextFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  return (
    <FormField label={label} controlId={controlId} hint={hint} errorMessage={errorMessage}>
      <input
        id={controlId}
        className={styles.control}
        {...fieldAccessibilityProps(controlId, { hint, errorMessage })}
        {...inputProps}
      />
    </FormField>
  );
}
