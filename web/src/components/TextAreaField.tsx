import { useId, type TextareaHTMLAttributes } from 'react';
import { classNames } from '../lib/class-names';
import { fieldAccessibilityProps, type FieldMessages } from './form-field-accessibility';
import { FormField } from './FormField';
import styles from './FormField.module.css';

type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> &
  FieldMessages & {
    label: string;
  };

export function TextAreaField({
  label,
  hint,
  errorMessage,
  id,
  className,
  ...textAreaProps
}: TextAreaFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  return (
    <FormField label={label} controlId={controlId} hint={hint} errorMessage={errorMessage}>
      <textarea
        id={controlId}
        className={classNames(styles.control, styles.textArea, className)}
        {...fieldAccessibilityProps(controlId, { hint, errorMessage })}
        {...textAreaProps}
      />
    </FormField>
  );
}
