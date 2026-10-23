import type { CreateTestFormField } from '@exam-room/shared';
import type { RenderedPage } from './render-pdf-pages';
import type { PdfPagesState } from './use-pdf-pages';
import {
  toTestSettings,
  validateTestSettings,
  type TestSettingsFormErrors,
  type TestSettingsFormValues,
} from './test-settings-form';

export type CreateTestFormErrors = TestSettingsFormErrors & { pdf?: string };

const FILE_EXTENSION_BY_IMAGE_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export function validateCreateTestForm(
  values: TestSettingsFormValues,
  pdfPages: PdfPagesState,
): CreateTestFormErrors {
  return { ...validateTestSettings(values), pdf: describePdfProblem(pdfPages, true) };
}

export function describePdfProblem(
  pdfPages: PdfPagesState,
  isRequired: boolean,
): string | undefined {
  if (pdfPages.status === 'reading') return 'Please wait until the PDF is ready.';
  if (pdfPages.status === 'failed') return 'Choose a PDF that can be read.';
  if (pdfPages.status === 'empty' && isRequired) return 'Choose the test paper PDF.';
  return undefined;
}

export function buildCreateTestFormData(
  values: TestSettingsFormValues,
  pages: RenderedPage[],
): FormData {
  const settings = toTestSettings(values);
  const formData = buildPagesFormData(pages);
  const appendText = (field: CreateTestFormField, text: string) => formData.append(field, text);

  appendText('subjectId', String(settings.subjectId));
  appendText('kind', settings.kind);
  appendText('chapterIds', settings.chapterIds.join(','));
  appendText('title', settings.title);
  appendText('durationMinutes', String(settings.durationMinutes));
  appendText('allowedExits', String(settings.allowedExits));
  appendText('leaveRule', settings.leaveRule);
  return formData;
}

export function buildPagesFormData(pages: RenderedPage[]): FormData {
  const formData = new FormData();
  const pagesField: CreateTestFormField = 'pages';
  pages.forEach((page, pageIndex) => {
    const extension = FILE_EXTENSION_BY_IMAGE_TYPE[page.image.type] ?? 'bin';
    formData.append(pagesField, page.image, `page-${pageIndex + 1}.${extension}`);
  });
  return formData;
}
