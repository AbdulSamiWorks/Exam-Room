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
import {
  buildCreateTestFormData,
  buildTypedTestFormData,
  validateCreateTestForm,
  type CreateTestFormErrors,
} from './create-test-form';
import { PdfPicker } from './PdfPicker';
import { hasErrors, NEW_TEST_SETTINGS } from './test-settings-form';
import { TestSettingsFields } from './TestSettingsFields';
import { usePdfPages } from './use-pdf-pages';
import { useTestSettingsForm } from './use-test-settings-form';
import styles from './CreateTestPage.module.css';

const PAPER_KIND_CHOICES: Choice<PaperKind>[] = [
  { value: 'pages', label: 'PDF file' },
  { value: 'typed', label: 'Type or paste' },
];

export function CreateTestPage() {
  const navigate = useNavigate();
  const createTest = useCreateTest();
  const [paperKind, setPaperKind] = useState<PaperKind>('pages');
  const { pdfPages, choosePdf } = usePdfPages();
  const paperDraft = usePaperDraft();
  const { values, errors, setErrors, updateValues } = useTestSettingsForm<CreateTestFormErrors>(
    () => NEW_TEST_SETTINGS,
  );

  function choosePdfFile(pdfFile: File) {
    setErrors((currentErrors) => ({ ...currentErrors, pdf: undefined }));
    void choosePdf(pdfFile);
  }

  function buildFormData(): FormData | undefined {
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
          onChange={setPaperKind}
        />

        {paperKind === 'pages' ? (
          <PdfPicker pdfPages={pdfPages} onChoose={choosePdfFile} errorMessage={errors.pdf} />
        ) : (
          <PaperEditor draft={paperDraft} errorMessage={errors.paper} />
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
