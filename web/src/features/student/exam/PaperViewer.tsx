import type { PageSize } from '@exam-room/shared';
import { useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { Button } from '../../../components/Button';
import { usePageImage, usePrefetchPageImage } from './use-page-image';
import { Watermark } from './Watermark';
import styles from './PaperViewer.module.css';

const MAX_ZOOM = 4;
const WHEEL_ZOOM_STEP = 0.15;
const DOUBLE_TAP_ZOOM_STEP = 1;
const FALLBACK_PAGE_SIZE: PageSize = { width: 1600, height: 2263 };

type PaperViewerProps = {
  testCode: string;
  attemptToken: string;
  pageSizes: PageSize[];
  watermarkText: string;
};

export function PaperViewer({
  testCode,
  attemptToken,
  pageSizes,
  watermarkText,
}: PaperViewerProps) {
  const [pageNumber, setPageNumber] = useState(1);
  const pageCount = pageSizes.length;
  const hasNextPage = pageNumber < pageCount;
  usePrefetchPageImage(testCode, attemptToken, hasNextPage ? pageNumber + 1 : undefined);

  return (
    <div className={styles.viewer}>
      <div className={styles.paperArea}>
        <TransformWrapper
          key={pageNumber}
          minScale={1}
          maxScale={MAX_ZOOM}
          centerZoomedOut
          disablePadding
          wheel={{ step: WHEEL_ZOOM_STEP }}
          doubleClick={{ mode: 'toggle', step: DOUBLE_TAP_ZOOM_STEP }}
          panning={{ velocityDisabled: true }}
        >
          <TransformComponent wrapperClass={styles.zoomArea} contentClass={styles.zoomContent}>
            <PaperPage
              testCode={testCode}
              attemptToken={attemptToken}
              pageNumber={pageNumber}
              pageSize={pageSizes[pageNumber - 1] ?? FALLBACK_PAGE_SIZE}
              watermarkText={watermarkText}
            />
          </TransformComponent>
        </TransformWrapper>
      </div>

      <nav className={styles.pageControls} aria-label="Pages">
        <Button
          variant="secondary"
          disabled={pageNumber === 1}
          onClick={() => setPageNumber(pageNumber - 1)}
        >
          ← Back
        </Button>
        <span className={styles.pagePosition}>
          Page {pageNumber} of {pageCount}
        </span>
        <Button
          variant="secondary"
          disabled={!hasNextPage}
          onClick={() => setPageNumber(pageNumber + 1)}
        >
          Next →
        </Button>
      </nav>
    </div>
  );
}

type PaperPageProps = {
  testCode: string;
  attemptToken: string;
  pageNumber: number;
  pageSize: PageSize;
  watermarkText: string;
};

function PaperPage({
  testCode,
  attemptToken,
  pageNumber,
  pageSize,
  watermarkText,
}: PaperPageProps) {
  const pageImage = usePageImage(testCode, attemptToken, pageNumber);

  return (
    <div className={styles.page} style={{ aspectRatio: `${pageSize.width} / ${pageSize.height}` }}>
      {pageImage.data && (
        <img
          src={pageImage.data}
          alt={`Page ${pageNumber}`}
          className={styles.pageImage}
          draggable={false}
        />
      )}
      <Watermark text={watermarkText} pageWidth={pageSize.width} pageHeight={pageSize.height} />
      <div className={styles.shield} />
      {pageImage.isPending && <p className={styles.pageMessage}>Loading page {pageNumber}…</p>}
      {pageImage.isError && (
        <div className={styles.pageMessage}>
          <p>This page could not be loaded.</p>
          <Button variant="secondary" onClick={() => void pageImage.refetch()}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
