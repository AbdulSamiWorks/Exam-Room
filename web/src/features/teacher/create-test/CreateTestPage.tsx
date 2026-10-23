import type { PaperKind } from '@exam-room/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/Button';
import { ChoiceGroup, type Choice } from '../../../components/ChoiceGroup';
import { FormError } from '../../../components/FormError';
import { Page } from '../../../components/Page';
import { PaperEditor } from '../paper/PaperEditor';
import { usePaperDraft } from '../paper/use-paper-draft';
import { useCreateTest } from '../tests/use-tests';
import { TextField } from '../../../components/TextField';
import {
  buildCreateTestFormData,
  buildOfflineAssignmentFormData,
  buildTypedTestFormData,
  validateCreateTestForm,
  type CreateTestFormErrors,
} from './create-test-form';
import { PdfPicker } from './PdfPicker';
import { testLimits } from './test-limits';
import { hasErrors, NEW_TEST_SETTINGS } from './test-settings-form';
import { TestSettingsFields } from './TestSettingsFields';
import { usePdfPages } from './use-pdf-pages';
import { useTestSettingsForm } from './use-test-settings-form';
import styles from './CreateTestPage.module.css';

const PAPER_KIND_CHOICES: Choice<PaperKind>[] = [
  { value: 'pages', label: 'PDF file' },
  { value: 'typed', label: 'Type or paste' },
  { value: 'none', label: 'No paper' },
];

export function CreateTestPage() {
  const navigate = useNavigate();
  const createTest = useCreateTest();
  const [chosenPaperKind, setPaperKind] = useState<PaperKind>('pages');
  const [offlineMaxMarks, setOfflineMaxMarks] = useState('20');
  const { pdfPages, choosePdf } = usePdfPages();
  const paperDraft = usePaperDraft();
  const { values, errors, setErrors, updateValues } = useTestSettingsForm<CreateTestFormErrors>(
    () => NEW_TEST_SETTINGS,
  );
  const paperKind =
    chosenPaperKind === 'none' && values.kind !== 'assignment' ? 'pages' : chosenPaperKind;

  function choosePdfFile(pdfFile: File) {
    setErrors((currentErrors) => ({ ...currentErrors, pdf: undefined }));
    void choosePdf(pdfFile);
  }

  function choosePaperKind(nextPaperKind: PaperKind) {
    setPaperKind(nextPaperKind);
    if (nextPaperKind === 'none') updateValues((current) => ({ ...current, kind: 'assignment' }));
  }

  function buildFormData(): FormData | undefined {
    if (paperKind === 'none') {
      return buildOfflineAssignmentFormData(values, Number(offlineMaxMarks));
    }
    if (paperKind === 'pages') {
      return pdfPages.status === 'ready'
        ? buildCreateTestFormData(values, pdfPages.pages)
        : undefined;
    }
    const upload = paperDraft.toUpload();
    return upload && buildTypedTestFormData(values, upload);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateCreateTestForm(
      values,
      paperKind,
      pdfPages,
      paperDraft.isReady,
    );
    const maxMarks = Number(offlineMaxMarks);
    if (paperKind === 'none' && !(maxMarks > 0 && maxMarks <= testLimits.maxOfflineMarks)) {
      validationErrors.maxMarks = `Enter the total marks, from 0.5 to ${testLimits.maxOfflineMarks}.`;
    }
    setErrors(validationErrors);
    const formData = buildFormData();
    if (hasErrors(validationErrors) || !formData) return;

    createTest.mutate(formData, {
      onSuccess: ({ test }) => navigate(`/teacher/tests/${test.id}`),
    });
  }

  return (
    <Page title="New test" backLink={{ to: '/teacher', label: 'All tests' }}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <ChoiceGroup
          label="Paper"
          choices={PAPER_KIND_CHOICES}
          selectedValue={paperKind}
          onChange={choosePaperKind}
        />

        {paperKind === 'pages' && (
          <PdfPicker pdfPages={pdfPages} onChoose={choosePdfFile} errorMessage={errors.pdf} />
        )}
        {paperKind === 'typed' && <PaperEditor draft={paperDraft} errorMessage={errors.paper} />}
        {paperKind === 'none' && (
          <TextField
            label="Total marks"
            hint="An assignment done on paper. After it, you type each student's marks."
            type="number"
            inputMode="decimal"
            min={0.5}
            step={0.5}
            value={offlineMaxMarks}
            onChange={(event) => setOfflineMaxMarks(event.target.value)}
            errorMessage={errors.maxMarks}
          />
        )}

        <TestSettingsFields values={values} errors={errors} onChange={updateValues} />

        {createTest.error && <FormError>{createTest.error.message}</FormError>}

        <Button type="submit" size="large" fullWidth disabled={createTest.isPending}>
          {createTest.isPending ? 'Creating test…' : 'Create test'}
        </Button>
      </form>
    </Page>
  );
}
