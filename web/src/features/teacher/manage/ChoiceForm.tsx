import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { SelectField } from '../../../components/SelectField';
import styles from './InlineForm.module.css';

export type FormChoice = {
  value: number;
  label: string;
};

type ChoiceFormProps = {
  label: string;
  hint?: string;
  placeholder: string;
  choices: readonly FormChoice[];
  submitLabel: string;
  busyLabel: string;
  onSubmit: (value: number) => Promise<unknown>;
  onCancel: () => void;
};

export function ChoiceForm({
  label,
  hint,
  placeholder,
  choices,
  submitLabel,
  busyLabel,
  onSubmit,
  onCancel,
}: ChoiceFormProps) {
  const [chosenValue, setChosenValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!chosenValue) {
      setErrorMessage(`${placeholder}.`);
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    try {
      await onSubmit(Number(chosenValue));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong.');
      setIsBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
      <SelectField
        label={label}
        hint={hint}
        value={chosenValue}
        onChange={(event) => {
          setChosenValue(event.target.value);
          setErrorMessage(undefined);
        }}
        errorMessage={errorMessage}
      >
        <option value="">{placeholder}</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </SelectField>
      <div className={styles.actions}>
        <Button type="submit" disabled={isBusy}>
          {isBusy ? busyLabel : submitLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
