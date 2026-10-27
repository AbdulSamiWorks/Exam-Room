import { useId } from 'react';
import { EXAM_TEXT_INPUT_PROPS } from './exam-text-input';
import styles from './WrittenAnswerBox.module.css';

const MAX_SHORT_ANSWER_LENGTH = 500;

type ShortAnswerBoxProps = {
  questionLabel: string;
  value: string;
  onChange: (text: string) => void;
};

export function ShortAnswerBox({ questionLabel, value, onChange }: ShortAnswerBoxProps) {
  const id = useId();
  return (
    <div className={styles.box}>
      <label htmlFor={id} className={styles.label}>
        Your answer to {questionLabel}
      </label>
      <textarea
        id={id}
        className={styles.shortArea}
        value={value}
        rows={2}
        maxLength={MAX_SHORT_ANSWER_LENGTH}
        enterKeyHint="done"
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault();
        }}
        onChange={(event) => onChange(event.target.value.replace(/\s*\n\s*/g, ' '))}
        {...EXAM_TEXT_INPUT_PROPS}
      />
    </div>
  );
}
