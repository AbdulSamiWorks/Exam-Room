import { useCallback, useRef, useState } from 'react';
import { PdfReadError, renderPdfPages, type RenderedPage } from './render-pdf-pages';
import { testLimits } from './test-limits';

export type PdfPagesState =
  | { status: 'empty' }
  | { status: 'reading'; fileName: string; renderedPages: number; totalPages: number }
  | { status: 'ready'; fileName: string; pages: RenderedPage[] }
  | { status: 'failed'; fileName: string; message: string };

const UNEXPECTED_READ_ERROR = 'This PDF could not be read. Please try another file.';

export function usePdfPages() {
  const [pdfPages, setPdfPages] = useState<PdfPagesState>({ status: 'empty' });
  const latestRequestNumber = useRef(0);

  const choosePdf = useCallback(async (pdfFile: File) => {
    const requestNumber = ++latestRequestNumber.current;
    const isStillLatestRequest = () => requestNumber === latestRequestNumber.current;
    const fileName = pdfFile.name;

    setPdfPages({ status: 'reading', fileName, renderedPages: 0, totalPages: 0 });
    try {
      const pages = await renderPdfPages(pdfFile, testLimits.maxPages, (progress) => {
        if (isStillLatestRequest()) setPdfPages({ status: 'reading', fileName, ...progress });
      });
      if (isStillLatestRequest()) setPdfPages({ status: 'ready', fileName, pages });
    } catch (error) {
      if (!isStillLatestRequest()) return;
      const message = error instanceof PdfReadError ? error.message : UNEXPECTED_READ_ERROR;
      setPdfPages({ status: 'failed', fileName, message });
    }
  }, []);

  return { pdfPages, choosePdf };
}
