import type { TestSummary } from '@exam-room/shared';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import {
  buildPagesFormData,
  describePdfProblem,
  type CreateTestFormErrors,
} from '../create-test/create-test-form';
import { PdfPicker } from '../create-test/PdfPicker';
import {
  hasErrors,
  settingsFormValuesOf,
  toUpdateTestRequest,
  validateTestSettings,
} from '../create-test/test-settings-form';
import { TestSettingsFields } from '../create-test/TestSettingsFields';
import { usePdfPages } from '../create-test/use-pdf-pages';
import { useTestSettingsForm } from '../create-test/use-test-settings-form';
import { useReplacePaper, useTest, useUpdateTest } from '../tests/use-tests';
import styles from './EditTestPage.module.css';

export function EditTestPage() {
  const testId = Number(useParams().testId);
  const testQuery = useTest(testId);
  const backLink = { to: `/teacher/tests/${testId}`, label: 'Back to the test' };

  if (testQuery.isPending) return <LoadingScreen />;
  if (testQuery.isError) {
    return (
      <Page title="Edit test" backLink={backLink}>
        <FormError>{testQuery.error.message}</FormError>
      </Page>
    );
  }

  return (
    <Page title="Edit test" subtitle={testQuery.data.title} backLink={backLink}>
      <EditTestForm key={testQuery.data.id} test={testQuery.data} />
    </Page>
  );
}

function EditTestForm({ test }: { test: TestSummary }) {
  const navigate = useNavigate();
  const updateTest = useUpdateTest(test.id);
  const replacePaper = useReplacePaper(test.id);
  const { pdfPages, choosePdf } = usePdfPages();
  const { values, errors, setErrors, updateValues } = useTestSettingsForm<CreateTestFormErrors>(
    () => settingsFormValuesOf(test),
  );
  const hasStudents = test.studentCount > 0;
  const isSaving = updateTest.isPending || replacePaper.isPending;
  const saveError = updateTest.error ?? replacePaper.error;

  function choosePdfFile(pdfFile: File) {
    setErrors((currentErrors) => ({ ...currentErrors, pdf: undefined }));
    void choosePdf(pdfFile);
  }

  async function saveChanges(): Promise<void> {
    await updateTest.mutateAsync(toUpdateTestRequest(values, hasStudents));
    if (pdfPages.status === 'ready') {
      await replacePaper.mutateAsync(buildPagesFormData(pdfPages.pages));
    }
    await navigate(`/teacher/tests/${test.id}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors: CreateTestFormErrors = {
      ...validateTestSettings(values),
      pdf: describePdfProblem(pdfPages, false),
    };
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;
    saveChanges().catch(() => undefined);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {hasStudents && (
        <p className={styles.note}>
          Students have already started this test. You can change the title, type, subject and
          chapters; the time limit, exits, leave rule and paper stay as they are.
        </p>
      )}

      <TestSettingsFields
        values={values}
        errors={errors}
        onChange={updateValues}
        areRulesFixed={hasStudents}
      />

      {!hasStudents && (
        <PdfPicker
          label="Replace the paper (optional)"
          pdfPages={pdfPages}
          onChoose={choosePdfFile}
          errorMessage={errors.pdf}
        />
      )}

      {saveError && <FormError>{saveError.message}</FormError>}

      <Button type="submit" size="large" fullWidth disabled={isSaving}>
        {isSaving ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}
