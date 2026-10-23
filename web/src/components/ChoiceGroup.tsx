import { useId } from 'react';
import { classNames } from '../lib/class-names';
import styles from './ChoiceGroup.module.css';
import fieldStyles from './FormField.module.css';

export type Choice<Value extends string | number> = {
  value: Value;
  label: string;
};

type ChoiceGroupProps<Value extends string | number> = {
  label: string;
  hint?: string;
  choices: Choice<Value>[];
  selectedValue: Value;
  disabled?: boolean;
  onChange: (value: Value) => void;
};

export function ChoiceGroup<Value extends string | number>({
  label,
  hint,
  choices,
  selectedValue,
  disabled = false,
  onChange,
}: ChoiceGroupProps<Value>) {
  const groupName = useId();

  return (
    <fieldset
      className={classNames(fieldStyles.field, disabled && styles.disabled)}
      disabled={disabled}
    >
      <legend className={fieldStyles.label}>{label}</legend>
      {hint && <p className={fieldStyles.hint}>{hint}</p>}
      <div className={styles.choices}>
        {choices.map((choice) => {
          const isSelected = choice.value === selectedValue;
          return (
            <label
              key={choice.value}
              className={classNames(styles.choice, isSelected && styles.selected)}
            >
              <input
                type="radio"
                name={groupName}
                className={styles.radio}
                checked={isSelected}
                onChange={() => onChange(choice.value)}
              />
              {choice.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
