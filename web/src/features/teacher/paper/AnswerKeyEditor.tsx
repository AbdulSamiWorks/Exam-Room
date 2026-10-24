import type { AnswerKey, Paper } from '@exam-room/shared';
import { numberQuestions, optionLetter } from '@exam-room/shared/paper-rules';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { Chip } from '../../../components/Chip';
import { FormError } from '../../../components/FormError';
import { TextField } from '../../../components/TextField';
import { answerKeyFromLetters, lettersOfAnswerKey, withChosenOptions } from './answer-sheet';
import styles from './PaperPage.module.css';

type AnswerKeyEditorProps = {
  paper: Paper;
  answerKey: AnswerKey;
  isSaving: boolean;
  errorMessage?: string;
  onSave: (answerKey: AnswerKey) => void;
};

export function AnswerKeyEditor({
  paper,
  answerKey,
  isSaving,
  errorMessage,
  onSave,
}: AnswerKeyEditorProps) {
  const [draft, setDraft] = useState(answerKey);
  const [letters, setLetters] = useState(() => lettersOfAnswerKey(paper, answerKey));
  const [lettersProblem, setLettersProblem] = useState<string>();
  const mcqs = numberQuestions(paper).filter((question) => question.kind === 'mcq');

  if (mcqs.length === 0) {
    return <p className={styles.note}>This paper has no multiple choice questions.</p>;
  }

  function chooseOption(questionId: string, option: number) {
    const next: AnswerKey = { ...draft, [questionId]: { ...draft[questionId], option } };
    setDraft(next);
    setLetters(lettersOfAnswerKey(paper, next));
  }

  function typeLetters(text: string) {
    setLetters(text);
    const { answerKey: typedAnswers, problem } = answerKeyFromLetters(paper, text);
    setLettersProblem(problem);
    if (!problem) setDraft(withChosenOptions(draft, typedAnswers));
  }

  return (
    <div className={styles.answerKey}>
      <TextField
        label="Type the answers in order"
        hint="For example BCADB… Use ? to skip a question."
        value={letters}
        autoCapitalize="characters"
        spellCheck={false}
        onChange={(event) => typeLetters(event.target.value)}
        errorMessage={lettersProblem}
      />
      <ol className={styles.answerList}>
        {mcqs.map((question) => (
          <li key={question.id} className={styles.answerRow}>
            <span className={styles.answerNumber}>{question.number}.</span>
            <span className={styles.answerChips}>
              {question.options.map((_option, optionIndex) => (
                <Chip
                  key={optionIndex}
                  label={optionLetter(optionIndex)}
                  isSelected={draft[question.id]?.option === optionIndex}
                  onClick={() => chooseOption(question.id, optionIndex)}
                />
              ))}
            </span>
          </li>
        ))}
      </ol>
      {errorMessage && <FormError>{errorMessage}</FormError>}
      <Button onClick={() => onSave(draft)} disabled={isSaving || Boolean(lettersProblem)}>
        {isSaving ? 'Saving…' : 'Save answers'}
      </Button>
    </div>
  );
}
