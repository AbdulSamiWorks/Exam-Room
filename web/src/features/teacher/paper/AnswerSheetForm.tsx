import type { AnswerKey, Paper } from '@exam-room/shared';
import { keepAnswersOfPaper, paperLimits } from '@exam-room/shared/paper-rules';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { TextField } from '../../../components/TextField';
import { answerSheetPlanOf, buildAnswerSheet, type AnswerSheetPlan } from './answer-sheet';
import type { PaperUpload } from './paper-upload';
import styles from './PaperPage.module.css';

type AnswerSheetFormProps = {
  currentSheet: Paper | null;
  currentAnswerKey: AnswerKey;
  isSaving: boolean;
  errorMessage?: string;
  onSave: (upload: PaperUpload) => void;
};

type PlanField = keyof AnswerSheetPlan;

const FIELDS: Array<{ field: PlanField; label: string; min: number; max: number; step?: number }> =
  [
    {
      field: 'mcqCount',
      label: 'Multiple choice questions',
      min: 0,
      max: paperLimits.maxQuestions,
    },
    { field: 'optionCount', label: 'Options per question', min: 2, max: paperLimits.maxOptions },
    { field: 'mcqMarks', label: 'Marks for each', min: 0.5, max: 100, step: 0.5 },
    { field: 'writtenCount', label: 'Written questions', min: 0, max: paperLimits.maxQuestions },
    { field: 'writtenMarks', label: 'Marks for each written one', min: 0.5, max: 100, step: 0.5 },
  ];

export function AnswerSheetForm({
  currentSheet,
  currentAnswerKey,
  isSaving,
  errorMessage,
  onSave,
}: AnswerSheetFormProps) {
  const [plan, setPlan] = useState<Record<PlanField, string>>(() =>
    toTextPlan(
      currentSheet
        ? answerSheetPlanOf(currentSheet)
        : { mcqCount: 20, optionCount: 4, mcqMarks: 1, writtenCount: 0, writtenMarks: 5 },
    ),
  );
  const [problem, setProblem] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numbers = toNumberPlan(plan);
    if (!numbers) {
      setProblem('Check the numbers.');
      return;
    }
    if (numbers.mcqCount + numbers.writtenCount === 0) {
      setProblem('Add at least one question.');
      return;
    }
    setProblem(undefined);
    const paper = buildAnswerSheet(numbers);
    onSave({ paper, answerKey: keepAnswersOfPaper(paper, currentAnswerKey), images: [] });
  }

  return (
    <form className={styles.sheetForm} onSubmit={submit} noValidate>
      <div className={styles.sheetFields}>
        {FIELDS.map(({ field, label, min, max, step }) => (
          <TextField
            key={field}
            label={label}
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step ?? 1}
            value={plan[field]}
            onChange={(event) =>
              setPlan((current) => ({ ...current, [field]: event.target.value }))
            }
          />
        ))}
      </div>
      {(problem ?? errorMessage) && <FormError>{problem ?? errorMessage}</FormError>}
      <Button type="submit" disabled={isSaving}>
        {isSaving ? 'Saving…' : currentSheet ? 'Save the answer sheet' : 'Add the answer sheet'}
      </Button>
    </form>
  );
}

function toTextPlan(plan: AnswerSheetPlan): Record<PlanField, string> {
  return Object.fromEntries(
    Object.entries(plan).map(([field, value]) => [field, String(value)]),
  ) as Record<PlanField, string>;
}

function toNumberPlan(plan: Record<PlanField, string>): AnswerSheetPlan | undefined {
  const numbers = Object.fromEntries(
    Object.entries(plan).map(([field, value]) => [field, Number(value)]),
  ) as AnswerSheetPlan;
  const isValid =
    Number.isInteger(numbers.mcqCount) &&
    Number.isInteger(numbers.writtenCount) &&
    Number.isInteger(numbers.optionCount) &&
    numbers.mcqCount >= 0 &&
    numbers.writtenCount >= 0 &&
    numbers.mcqCount + numbers.writtenCount <= paperLimits.maxQuestions &&
    numbers.optionCount >= paperLimits.minOptions &&
    numbers.optionCount <= paperLimits.maxOptions &&
    numbers.mcqMarks > 0 &&
    numbers.writtenMarks > 0;
  return isValid ? numbers : undefined;
}
