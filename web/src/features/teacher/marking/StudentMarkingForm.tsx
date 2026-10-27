import type { AttemptMarking, MarkingResponse, QuestionMark } from '@exam-room/shared';
import { checkUnit } from '@exam-room/shared/answer-checking';
import { markableUnitsOf, numberQuestions } from '@exam-room/shared/paper-rules';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { describeMarks, formatMarks } from '../../../lib/describe-marks';
import { useSaveMarks } from './use-marking';
import { RichText } from '../../paper/RichText';
import { AnswerPhotoGallery } from '../results/AnswerPhotoGallery';
import { UnitAnswerSummary } from './UnitAnswerSummary';
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
  const paper = marking.paper ?? { instructions: '', sections: [] };
  const units = markableUnitsOf(paper);
  const stemsByQuestionId = new Map(
    numberQuestions(paper).map((question) => [question.id, question.text]),
  );
  const answers = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const hasWrittenQuestions = units.some((unit) => unit.kind === 'written');

  function change(unitId: string, field: 'marks' | 'comment', value: string) {
    setDraft((current) => ({
      ...current,
      [unitId]: { marks: '', comment: '', ...current[unitId], [field]: value },
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
      {attempt.photoCount > 0 ? (
        <details className={styles.photoSection} open>
          <summary>Answer photos ({attempt.photoCount})</summary>
          <AnswerPhotoGallery attemptId={attempt.attemptId} isCompact />
        </details>
      ) : (
        hasWrittenQuestions && (
          <p className={styles.muted}>
            No answer photos from this student. You can still give marks from the paper or the typed
            answers.
          </p>
        )
      )}
      <ol className={styles.questionList}>
        {units.map((unit) => {
          const key = marking.answerKey[unit.id];
          const check = checkUnit(unit, key, answers);
          return (
            <li key={unit.id} className={styles.questionRow}>
              {unit.partLetter === 'a' && (
                <div className={styles.questionStem} dir="auto">
                  <strong>{unit.questionNumber}.</strong>{' '}
                  <RichText text={stemsByQuestionId.get(unit.questionId) ?? ''} />
                </div>
              )}
              <div className={styles.questionText} dir="auto">
                <strong>{unit.partLetter ? `${unit.partLetter})` : `${unit.label}.`}</strong>{' '}
                <span className={styles.muted}>({describeMarks(unit.marks)})</span>
                <RichText text={unit.text} />
              </div>
              {key?.text && (
                <details className={styles.modelAnswer}>
                  <summary>Model answer</summary>
                  <div dir="auto">
                    <RichText text={key.text} />
                  </div>
                </details>
              )}
              <UnitAnswerSummary unit={unit} answerKey={key} answers={answers} check={check} />
              <div className={styles.markFields}>
                <label className={styles.markField}>
                  Marks
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={unit.marks}
                    step={0.5}
                    placeholder={check ? `auto ${formatMarks(check.marks)}` : '–'}
                    value={draft[unit.id]?.marks ?? ''}
                    onChange={(event) => change(unit.id, 'marks', event.target.value)}
                  />
                </label>
                <label className={styles.commentField}>
                  Comment
                  <input
                    value={draft[unit.id]?.comment ?? ''}
                    dir="auto"
                    onChange={(event) => change(unit.id, 'comment', event.target.value)}
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
