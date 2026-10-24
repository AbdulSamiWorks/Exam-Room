import { useId } from 'react';
import styles from './WrittenAnswerBox.module.css';

const MAX_ANSWER_LENGTH = 5000;

type WrittenAnswerBoxProps = {
  questionNumber: number;
  value: string;
  onChange: (text: string) => void;
};

export function WrittenAnswerBox({ questionNumber, value, onChange }: WrittenAnswerBoxProps) {
  const id = useId();
  return (
    <div className={styles.box}>
      <label htmlFor={id} className={styles.label}>
        Your answer to question {questionNumber}
      </label>
      <textarea
        id={id}
        className={styles.textArea}
        value={value}
        dir="auto"
        rows={4}
        maxLength={MAX_ANSWER_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        onPaste={(event) => event.preventDefault()}
        onDrop={(event) => event.preventDefault()}
      />
    </div>
  );
}
