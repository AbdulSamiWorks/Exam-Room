import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

const PAGE_IMAGE_WIDTH_PX = 1600;
const PAGE_IMAGE_TYPE = 'image/webp';
const PAGE_IMAGE_QUALITY = 0.85;
const PAPER_WHITE = '#ffffff';

export type RenderedPage = {
  image: Blob;
  width: number;
  height: number;
};

export type RenderProgress = {
  renderedPages: number;
  totalPages: number;
};

export class PdfReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfReadError';
  }
}

export async function renderPdfPages(
  pdfFile: File,
  maxPages: number,
  onProgress: (progress: RenderProgress) => void,
): Promise<RenderedPage[]> {
  const pdfjs = await loadPdfJs();
  const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: pdfBytes });

  try {
    const pdfDocument = await openPdf(loadingTask);
    const totalPages = pdfDocument.numPages;
    if (totalPages > maxPages) {
      throw new PdfReadError(
        `This PDF has ${totalPages} pages. A test can have at most ${maxPages} pages.`,
      );
    }

    onProgress({ renderedPages: 0, totalPages });
    const renderedPages: RenderedPage[] = [];
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      renderedPages.push(await renderPage(await pdfDocument.getPage(pageNumber)));
      onProgress({ renderedPages: pageNumber, totalPages });
    }
    return renderedPages;
  } finally {
    await loadingTask.destroy();
  }
}

async function loadPdfJs() {
  const [pdfjs, pdfWorker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker.default;
  return pdfjs;
}

async function openPdf(loadingTask: PDFDocumentLoadingTask): Promise<PDFDocumentProxy> {
  try {
    return await loadingTask.promise;
  } catch (error) {
    const isPasswordProtected = error instanceof Error && error.name === 'PasswordException';
    throw new PdfReadError(
      isPasswordProtected
        ? 'This PDF is password-protected. Remove the password and try again.'
        : 'This file could not be opened as a PDF.',
    );
  }
}

async function renderPage(page: PDFPageProxy): Promise<RenderedPage> {
  const naturalSize = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: PAGE_IMAGE_WIDTH_PX / naturalSize.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  try {
    await page.render({ canvas, viewport, background: PAPER_WHITE }).promise;
    const image = await canvasToImage(canvas);
    return { image, width: canvas.width, height: canvas.height };
  } finally {
    page.cleanup();
    releaseCanvasMemory(canvas);
  }
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (image) =>
        image ? resolve(image) : reject(new PdfReadError('A page could not be prepared.')),
      PAGE_IMAGE_TYPE,
      PAGE_IMAGE_QUALITY,
    );
  });
}

function releaseCanvasMemory(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}
