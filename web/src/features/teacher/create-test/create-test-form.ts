import type { CreateTestFormField, PaperKind } from '@exam-room/shared';
import type { PaperUpload } from '../paper/paper-upload';
import { appendPaperUpload } from '../paper/use-paper';
import type { RenderedPage } from './render-pdf-pages';
import type { PdfPagesState } from './use-pdf-pages';
import {
  toTestSettings,
  validateTestSettings,
  type TestSettingsFormErrors,
  type TestSettingsFormValues,
} from './test-settings-form';

export type CreateTestFormErrors = TestSettingsFormErrors & {
  pdf?: string;
  paper?: string;
  maxMarks?: string;
};

const FILE_EXTENSION_BY_IMAGE_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export function validateCreateTestForm(
  values: TestSettingsFormValues,
  paperKind: PaperKind,
  pdfPages: PdfPagesState,
  isTypedPaperReady: boolean,
): CreateTestFormErrors {
  return {
    ...validateTestSettings(values),
    pdf: paperKind === 'pages' ? describePdfProblem(pdfPages, true) : undefined,
    durationMinutes:
      paperKind === 'none' ? undefined : validateTestSettings(values).durationMinutes,
    paper:
      paperKind === 'typed' && !isTypedPaperReady
        ? 'Paste the questions and fix the problems shown.'
        : undefined,
  };
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
  return appendSettings(buildPagesFormData(pages), values, 'pages');
}

export function buildOfflineAssignmentFormData(
  values: TestSettingsFormValues,
  maxMarks: number,
): FormData {
  const formData = new FormData();
  const field: CreateTestFormField = 'maxMarks';
  formData.append(field, String(maxMarks));
  return appendSettings(formData, values, 'none');
}

export function buildTypedTestFormData(
  values: TestSettingsFormValues,
  upload: PaperUpload,
): FormData {
  return appendSettings(appendPaperUpload(new FormData(), upload), values, 'typed');
}

function appendSettings(
  formData: FormData,
  values: TestSettingsFormValues,
  paperKind: PaperKind,
): FormData {
  const settings = toTestSettings(values);
  const appendText = (field: CreateTestFormField, text: string) => formData.append(field, text);

  appendText('paperKind', paperKind);
  appendText('subjectId', String(settings.subjectId));
  appendText('kind', settings.kind);
  appendText('chapterIds', settings.chapterIds.join(','));
  appendText('title', settings.title);
  appendText('durationMinutes', String(settings.durationMinutes));
  appendText('allowedExits', String(settings.allowedExits));
  appendText('leaveRule', settings.leaveRule);
  appendText('writtenAnswers', settings.writtenAnswers);
  appendText('bountyNote', settings.bountyNote);
  appendText('bountyPoints', String(settings.bountyPoints));
  appendText('waitingRoom', String(settings.waitingRoom));
  appendText('instantResult', String(settings.instantResult));
  appendText('shuffleQuestions', String(settings.shuffleQuestions));
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
