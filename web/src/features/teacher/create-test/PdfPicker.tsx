import { useId, type ChangeEvent } from 'react';
import fieldStyles from '../../../components/FormField.module.css';
import { classNames } from '../../../lib/class-names';
import { describePageCount } from '../tests/describe-test';
import type { PdfPagesState } from './use-pdf-pages';
import styles from './PdfPicker.module.css';

type PdfPickerProps = {
  pdfPages: PdfPagesState;
  onChoose: (pdfFile: File) => void;
  errorMessage?: string;
};

const CHOOSE_ANOTHER_FILE = 'Tap to choose a different file';

export function PdfPicker({ pdfPages, onChoose, errorMessage }: PdfPickerProps) {
  const labelId = useId();
  const { headline, details } = describePdfPagesState(pdfPages);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [chosenFile] = event.target.files ?? [];
    if (chosenFile) onChoose(chosenFile);
    event.target.value = '';
  }

  return (
    <div className={fieldStyles.field}>
      <p id={labelId} className={fieldStyles.label}>
        Test paper (PDF)
      </p>
      <label
        className={classNames(
          styles.dropZone,
          pdfPages.status === 'ready' && styles.ready,
          (pdfPages.status === 'failed' || errorMessage) && styles.failed,
        )}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          className={styles.fileInput}
          aria-labelledby={labelId}
          onChange={handleFileChange}
        />
        <span className={styles.headline}>{headline}</span>
        <span className={styles.details}>{details}</span>
      </label>
      {errorMessage && <p className={fieldStyles.errorMessage}>{errorMessage}</p>}
    </div>
  );
}

function describePdfPagesState(pdfPages: PdfPagesState): { headline: string; details: string } {
  switch (pdfPages.status) {
    case 'empty':
      return {
        headline: 'Choose PDF file',
        details: 'Pages are turned into images on this device. Students never get the PDF.',
      };
    case 'reading': {
      const { renderedPages, totalPages } = pdfPages;
      const pageInProgress = Math.min(renderedPages + 1, totalPages);
      return {
        headline:
          totalPages === 0 ? 'Opening PDF…' : `Preparing page ${pageInProgress} of ${totalPages}…`,
        details: pdfPages.fileName,
      };
    }
    case 'ready':
      return {
        headline: `${describePageCount(pdfPages.pages.length)} ready`,
        details: `${pdfPages.fileName} · ${CHOOSE_ANOTHER_FILE}`,
      };
    case 'failed':
      return { headline: pdfPages.message, details: CHOOSE_ANOTHER_FILE };
  }
}
