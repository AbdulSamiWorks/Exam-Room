import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { fieldAccessibilityProps, type FieldMessages } from './form-field-accessibility';
import { FormField } from './FormField';
import styles from './FormField.module.css';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> &
  FieldMessages & {
    label: string;
    children: ReactNode;
  };

export function SelectField({
  label,
  hint,
  errorMessage,
  id,
  children,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  return (
    <FormField label={label} controlId={controlId} hint={hint} errorMessage={errorMessage}>
      <select
        id={controlId}
        className={styles.control}
        {...fieldAccessibilityProps(controlId, { hint, errorMessage })}
        {...selectProps}
      >
        {children}
      </select>
    </FormField>
  );
}
