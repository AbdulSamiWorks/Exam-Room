import { useState, type KeyboardEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { TextField } from '../../../components/TextField';
import styles from './ClassSubjectPicker.module.css';

type QuickAddFormProps = {
  label: string;
  hint?: string;
  placeholder: string;
  maxLength: number;
  addLabel: string;
  isAdding: boolean;
  addError: Error | null;
  fieldError?: string;
  autoFocus?: boolean;
  onAdd: (name: string) => void;
  onCancel?: () => void;
};

export function QuickAddForm({
  label,
  hint,
  placeholder,
  maxLength,
  addLabel,
  isAdding,
  addError,
  fieldError,
  autoFocus,
  onAdd,
  onCancel,
}: QuickAddFormProps) {
  const [name, setName] = useState('');

  function add() {
    if (name.trim()) onAdd(name);
  }

  function addOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    add();
  }

  return (
    <div className={styles.addSubject}>
      <TextField
        label={label}
        hint={hint}
        placeholder={placeholder}
        value={name}
        maxLength={maxLength}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={addOnEnter}
        errorMessage={fieldError}
        autoFocus={autoFocus}
      />
      {addError && <FormError>{addError.message}</FormError>}
      <div className={styles.actions}>
        <Button onClick={add} disabled={isAdding || !name.trim()}>
          {isAdding ? 'Adding…' : addLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
