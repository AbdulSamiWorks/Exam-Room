import { useId } from 'react';
import { EXAM_TEXT_INPUT_PROPS } from './exam-text-input';
import styles from './WrittenAnswerBox.module.css';

const MAX_ANSWER_LENGTH = 5000;

type WrittenAnswerBoxProps = {
  questionLabel: string;
  value: string;
  onChange: (text: string) => void;
};

export function WrittenAnswerBox({ questionLabel, value, onChange }: WrittenAnswerBoxProps) {
  const id = useId();
  return (
    <div className={styles.box}>
      <label htmlFor={id} className={styles.label}>
        Your answer to question {questionLabel}
      </label>
      <textarea
        id={id}
        className={styles.textArea}
        value={value}
        rows={4}
        maxLength={MAX_ANSWER_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        {...EXAM_TEXT_INPUT_PROPS}
      />
    </div>
  );
}
