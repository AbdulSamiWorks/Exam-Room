import { EXAM_TEXT_INPUT_PROPS } from './exam-text-input';
import styles from './BlankInput.module.css';

const MAX_BLANK_LENGTH = 200;
const SMALLEST_WIDTH_IN_CHARACTERS = 7;

type BlankInputProps = {
  label: string;
  value: string;
  onChange: (text: string) => void;
};

export function BlankInput({ label, value, onChange }: BlankInputProps) {
  return (
    <input
      type="text"
      className={styles.blank}
      aria-label={label}
      value={value}
      size={Math.max(SMALLEST_WIDTH_IN_CHARACTERS, value.length + 1)}
      maxLength={MAX_BLANK_LENGTH}
      enterKeyHint="next"
      onChange={(event) => onChange(event.target.value)}
      {...EXAM_TEXT_INPUT_PROPS}
    />
  );
}
