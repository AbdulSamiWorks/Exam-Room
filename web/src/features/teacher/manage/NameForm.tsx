import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import styles from './NameForm.module.css';

type NameFormProps = {
  label: string;
  initialName?: string;
  placeholder?: string;
  maxLength: number;
  submitLabel: string;
  busyLabel: string;
  clearsAfterSubmit?: boolean;
  autoFocus?: boolean;
  onSubmit: (name: string) => Promise<unknown>;
  onCancel?: () => void;
};

export function NameForm({
  label,
  initialName = '',
  placeholder,
  maxLength,
  submitLabel,
  busyLabel,
  clearsAfterSubmit = false,
  autoFocus = false,
  onSubmit,
  onCancel,
}: NameFormProps) {
  const [name, setName] = useState(initialName);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!name.trim()) {
      setErrorMessage(`Enter the ${label.toLowerCase()}.`);
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      await onSubmit(name.trim());
      if (clearsAfterSubmit) setName('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <TextField
        label={label}
        value={name}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onChange={(event) => {
          setName(event.target.value);
          setErrorMessage(undefined);
        }}
        errorMessage={errorMessage}
      />
      <div className={styles.actions}>
        <Button type="submit" disabled={isBusy}>
          {isBusy ? busyLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
