import type { AllowedExits, CreateTestFormField } from '@exam-room/shared';
import type { RenderedPage } from './render-pdf-pages';
import { testLimits } from './test-limits';
import type { PdfPagesState } from './use-pdf-pages';

export type CreateTestFormValues = {
  subjectId: string;
  title: string;
  durationMinutes: string;
  allowedExits: AllowedExits;
};

export type CreateTestFormErrors = Partial<
  Record<'pdf' | 'subjectId' | 'title' | 'durationMinutes', string>
>;

const FILE_EXTENSION_BY_IMAGE_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export function validateCreateTestForm(
  values: CreateTestFormValues,
  pdfPages: PdfPagesState,
): CreateTestFormErrors {
  const errors: CreateTestFormErrors = {};

  if (pdfPages.status === 'reading') errors.pdf = 'Please wait until the PDF is ready.';
  else if (pdfPages.status !== 'ready') errors.pdf = 'Choose the test paper PDF.';

  if (!values.subjectId) errors.subjectId = 'Choose a subject.';

  const title = values.title.trim();
  if (!title) errors.title = 'Enter a title for the test.';
  else if (title.length > testLimits.maxTitleLength) {
    errors.title = `Use at most ${testLimits.maxTitleLength} characters.`;
  }

  const durationMinutes = Number(values.durationMinutes);
  const isValidDuration =
    Number.isInteger(durationMinutes) &&
    durationMinutes >= testLimits.minDurationMinutes &&
    durationMinutes <= testLimits.maxDurationMinutes;
  if (!isValidDuration) {
    errors.durationMinutes = `Enter whole minutes from ${testLimits.minDurationMinutes} to ${testLimits.maxDurationMinutes}.`;
  }

  return errors;
}

export function hasErrors(errors: CreateTestFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function buildCreateTestFormData(
  values: CreateTestFormValues,
  pages: RenderedPage[],
): FormData {
  const formData = new FormData();
  const appendText = (field: CreateTestFormField, text: string) => formData.append(field, text);
  const appendFile = (field: CreateTestFormField, file: Blob, fileName: string) =>
    formData.append(field, file, fileName);

  appendText('subjectId', values.subjectId);
  appendText('title', values.title.trim());
  appendText('durationMinutes', values.durationMinutes);
  appendText('allowedExits', String(values.allowedExits));
  pages.forEach((page, pageIndex) => {
    const extension = FILE_EXTENSION_BY_IMAGE_TYPE[page.image.type] ?? 'bin';
    appendFile('pages', page.image, `page-${pageIndex + 1}.${extension}`);
  });

  return formData;
}
