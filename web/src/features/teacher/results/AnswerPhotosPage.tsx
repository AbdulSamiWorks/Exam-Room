import { useLocation, useParams } from 'react-router';
import { Page } from '../../../components/Page';
import { AnswerPhotoGallery } from './AnswerPhotoGallery';

type PhotoPageState = {
  studentName?: string;
  backTo?: string;
};

export function AnswerPhotosPage() {
  const attemptId = Number(useParams().attemptId);
  const state = (useLocation().state ?? {}) as PhotoPageState;
  const backLink = { to: state.backTo ?? '/teacher', label: 'Back to the results' };

  return (
    <Page title="Answer photos" subtitle={state.studentName} backLink={backLink}>
      <AnswerPhotoGallery attemptId={attemptId} />
    </Page>
  );
}
