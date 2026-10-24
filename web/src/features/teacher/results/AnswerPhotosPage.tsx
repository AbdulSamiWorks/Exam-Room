import type { AnswerPhotoListResponse } from '@exam-room/shared';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router';
import { getJson } from '../../../api/http-client';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import styles from './AnswerPhotosPage.module.css';

type PhotoPageState = {
  studentName?: string;
  backTo?: string;
};

export function AnswerPhotosPage() {
  const attemptId = Number(useParams().attemptId);
  const state = (useLocation().state ?? {}) as PhotoPageState;
  const photosQuery = useQuery({
    queryKey: ['attempt-photos', attemptId],
    queryFn: () => getJson<AnswerPhotoListResponse>(`/attempts/${attemptId}/photos`),
  });
  const backLink = { to: state.backTo ?? '/teacher', label: 'Back to the results' };

  if (photosQuery.isPending) return <LoadingScreen />;

  return (
    <Page title="Answer photos" subtitle={state.studentName} backLink={backLink}>
      {photosQuery.isError && <FormError>{photosQuery.error.message}</FormError>}
      {photosQuery.data?.photos.length === 0 && <p>No photos yet.</p>}
      <ol className={styles.photos}>
        {photosQuery.data?.photos.map((photo) => (
          <li key={photo.photoNumber}>
            <a
              href={`/api/attempts/${attemptId}/photos/${photo.photoNumber}`}
              target="_blank"
              rel="noreferrer"
            >
              <img
                className={styles.photo}
                src={`/api/attempts/${attemptId}/photos/${photo.photoNumber}`}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                alt={`Photo ${photo.photoNumber}`}
              />
            </a>
          </li>
        ))}
      </ol>
    </Page>
  );
}
