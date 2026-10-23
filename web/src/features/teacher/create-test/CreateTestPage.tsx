import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { Page } from '../../../components/Page';
import { useCreateTest } from '../tests/use-tests';
import {
  buildCreateTestFormData,
  validateCreateTestForm,
  type CreateTestFormErrors,
} from './create-test-form';
import { PdfPicker } from './PdfPicker';
import { hasErrors, NEW_TEST_SETTINGS } from './test-settings-form';
import { TestSettingsFields } from './TestSettingsFields';
import { usePdfPages } from './use-pdf-pages';
import { useTestSettingsForm } from './use-test-settings-form';
import styles from './CreateTestPage.module.css';

export function CreateTestPage() {
  const navigate = useNavigate();
  const createTest = useCreateTest();
  const { pdfPages, choosePdf } = usePdfPages();
  const { values, errors, setErrors, updateValues } = useTestSettingsForm<CreateTestFormErrors>(
    () => NEW_TEST_SETTINGS,
  );

  function choosePdfFile(pdfFile: File) {
    setErrors((currentErrors) => ({ ...currentErrors, pdf: undefined }));
    void choosePdf(pdfFile);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateCreateTestForm(values, pdfPages);
    setErrors(validationErrors);
    if (hasErrors(validationErrors) || pdfPages.status !== 'ready') return;

    createTest.mutate(buildCreateTestFormData(values, pdfPages.pages), {
      onSuccess: ({ test }) => navigate(`/teacher/tests/${test.id}`),
    });
  }

  return (
    <Page title="New test" backLink={{ to: '/teacher', label: 'All tests' }}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <PdfPicker pdfPages={pdfPages} onChoose={choosePdfFile} errorMessage={errors.pdf} />

        <TestSettingsFields values={values} errors={errors} onChange={updateValues} />

        {createTest.error && <FormError>{createTest.error.message}</FormError>}

        <Button type="submit" size="large" fullWidth disabled={createTest.isPending}>
          {createTest.isPending ? 'Creating test…' : 'Create test'}
        </Button>
      </form>
    </Page>
  );
}
