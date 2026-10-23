import type { AttemptMarking, MarkingResponse, QuestionMark } from '@exam-room/shared';
import { numberQuestions, optionLetter } from '@exam-room/shared/paper-rules';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { describeMarks } from '../../../lib/describe-marks';
import { useSaveMarks } from './use-marking';
import styles from './MarkingPage.module.css';

type StudentMarkingFormProps = {
  testId: number;
  marking: MarkingResponse;
  attempt: AttemptMarking;
  onSaved: () => void;
};

type MarkDraft = Record<string, { marks: string; comment: string }>;

export function StudentMarkingForm({ testId, marking, attempt, onSaved }: StudentMarkingFormProps) {
  const saveMarks = useSaveMarks(testId);
  const [draft, setDraft] = useState<MarkDraft>(() => draftOf(attempt.questionMarks));
  const [comment, setComment] = useState(attempt.comment);
  const questions = marking.paper ? numberQuestions(marking.paper) : [];
  const answers = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));

  function change(questionId: string, field: 'marks' | 'comment', value: string) {
    setDraft((current) => ({
      ...current,
      [questionId]: { marks: '', comment: '', ...current[questionId], [field]: value },
    }));
  }

  function save() {
    saveMarks.mutate(
      { attemptId: attempt.attemptId, marks: { questionMarks: marksOf(draft), comment } },
      { onSuccess: onSaved },
    );
  }

  return (
    <div className={styles.markingForm}>
      {attempt.photoCount > 0 && (
        <Link
          to={`/teacher/attempts/${attempt.attemptId}/photos`}
          state={{ studentName: attempt.studentName, backTo: `/teacher/tests/${testId}/marking` }}
          className={styles.photoLink}
        >
          See the {attempt.photoCount} answer photos
        </Link>
      )}
      <ol className={styles.questionList}>
        {questions.map((question) => {
          const answer = answers.get(question.id);
          const correctOption = marking.answerKey[question.id]?.option;
          return (
            <li key={question.id} className={styles.questionRow}>
              <p className={styles.questionText} dir="auto">
                <strong>{question.number}.</strong> {question.text}{' '}
                <span className={styles.muted}>({describeMarks(question.marks)})</span>
              </p>
              {question.kind === 'mcq' ? (
                <p className={styles.answerLine}>
                  Chose{' '}
                  <strong>
                    {answer?.choice === null || answer?.choice === undefined
                      ? 'nothing'
                      : optionLetter(answer.choice)}
                  </strong>
                  {correctOption !== undefined && ` · correct is ${optionLetter(correctOption)}`}
                  {answer?.choice !== undefined && answer.choice === correctOption ? ' ✓' : ''}
                </p>
              ) : (
                <p className={styles.typedAnswer} dir="auto">
                  {answer?.text || 'No typed answer (see the photos or the paper).'}
                </p>
              )}
              <div className={styles.markFields}>
                <label className={styles.markField}>
                  Marks
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={question.marks}
                    step={0.5}
                    placeholder={question.kind === 'mcq' ? 'auto' : '–'}
                    value={draft[question.id]?.marks ?? ''}
                    onChange={(event) => change(question.id, 'marks', event.target.value)}
                  />
                </label>
                <label className={styles.commentField}>
                  Comment
                  <input
                    value={draft[question.id]?.comment ?? ''}
                    dir="auto"
                    onChange={(event) => change(question.id, 'comment', event.target.value)}
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ol>
      <label className={styles.commentField}>
        Comment for the student
        <textarea
          value={comment}
          dir="auto"
          rows={2}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      {saveMarks.error && <FormError>{saveMarks.error.message}</FormError>}
      <Button onClick={save} disabled={saveMarks.isPending}>
        {saveMarks.isPending ? 'Saving…' : 'Save marks'}
      </Button>
    </div>
  );
}

function draftOf(questionMarks: Record<string, QuestionMark>): MarkDraft {
  return Object.fromEntries(
    Object.entries(questionMarks).map(([questionId, mark]) => [
      questionId,
      { marks: mark.marks === null ? '' : String(mark.marks), comment: mark.comment },
    ]),
  );
}

function marksOf(draft: MarkDraft): Record<string, QuestionMark> {
  return Object.fromEntries(
    Object.entries(draft).map(([questionId, mark]) => [
      questionId,
      { marks: mark.marks.trim() === '' ? null : Number(mark.marks), comment: mark.comment.trim() },
    ]),
  );
}
