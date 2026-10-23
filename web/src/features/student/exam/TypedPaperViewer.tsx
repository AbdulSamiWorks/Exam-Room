import type { NumberedQuestion, Paper } from '@exam-room/shared';
import { highestImageNumber } from '@exam-room/shared/paper-rules';
import type { ReactNode } from 'react';
import { Button } from '../../../components/Button';
import { PaperView, type PaperViewProps } from '../../paper/PaperView';
import { useExamImage, usePrefetchExamImages } from './use-page-image';
import { useStudentPaper } from './use-student-paper';
import styles from './TypedPaperViewer.module.css';

type TypedPaperViewerProps = Pick<
  PaperViewProps,
  'chosenOptions' | 'onChooseOption' | 'renderQuestionExtra'
> & {
  testCode: string;
  attemptToken: string;
  footer?: ReactNode;
};

export function TypedPaperViewer({
  testCode,
  attemptToken,
  footer,
  ...answering
}: TypedPaperViewerProps) {
  const paperQuery = useStudentPaper(testCode, attemptToken);

  if (paperQuery.isPending) return <p className={styles.message}>Loading the questions…</p>;
  if (paperQuery.isError) {
    return (
      <div className={styles.message}>
        <p>The questions could not be loaded. Check the internet.</p>
        <Button variant="secondary" onClick={() => void paperQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <LoadedPaper
      testCode={testCode}
      attemptToken={attemptToken}
      paper={paperQuery.data}
      footer={footer}
      {...answering}
    />
  );
}

function LoadedPaper({
  testCode,
  attemptToken,
  paper,
  footer,
  ...answering
}: TypedPaperViewerProps & { paper: Paper }) {
  usePrefetchExamImages(testCode, attemptToken, 'picture', highestImageNumber(paper));

  return (
    <div className={styles.scrollArea}>
      <div className={styles.sheet}>
        <PaperView
          paper={paper}
          renderPicture={(imageNumber, question) => (
            <ExamPicture
              testCode={testCode}
              attemptToken={attemptToken}
              imageNumber={imageNumber}
              question={question}
            />
          )}
          {...answering}
        />
        {footer}
      </div>
    </div>
  );
}

type ExamPictureProps = {
  testCode: string;
  attemptToken: string;
  imageNumber: number;
  question: NumberedQuestion;
};

function ExamPicture({ testCode, attemptToken, imageNumber, question }: ExamPictureProps) {
  const picture = useExamImage(testCode, attemptToken, { kind: 'picture', number: imageNumber });

  if (!picture.data) {
    return (
      <p className={styles.pictureNote}>
        {picture.isError ? 'Picture not loaded.' : 'Loading picture…'}
      </p>
    );
  }
  return (
    <div className={styles.picture}>
      <img src={picture.data} alt={`Picture for question ${question.number}`} />
      <div className={styles.shield} />
    </div>
  );
}
