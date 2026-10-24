import type { AnswerPhotoListResponse } from '@exam-room/shared';
import { useQuery } from '@tanstack/react-query';
import { getJson } from '../../../api/http-client';
import { FormError } from '../../../components/FormError';
import { classNames } from '../../../lib/class-names';
import styles from './AnswerPhotoGallery.module.css';

type AnswerPhotoGalleryProps = {
  attemptId: number;
  isCompact?: boolean;
};

export function AnswerPhotoGallery({ attemptId, isCompact = false }: AnswerPhotoGalleryProps) {
  const photosQuery = useQuery({
    queryKey: ['attempt-photos', attemptId],
    queryFn: () => getJson<AnswerPhotoListResponse>(`/attempts/${attemptId}/photos`),
  });

  if (photosQuery.isPending) return <p className={styles.note}>Loading the photos…</p>;
  if (photosQuery.isError) return <FormError>{photosQuery.error.message}</FormError>;
  if (photosQuery.data.photos.length === 0) return <p className={styles.note}>No photos yet.</p>;

  return (
    <ol className={classNames(styles.photos, isCompact && styles.compact)}>
      {photosQuery.data.photos.map((photo) => {
        const photoPath = `/api/attempts/${attemptId}/photos/${photo.photoNumber}`;
        return (
          <li key={photo.photoNumber} className={styles.photoItem}>
            <a href={photoPath} target="_blank" rel="noreferrer">
              <img
                className={styles.photo}
                src={photoPath}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                alt={`Page ${photo.photoNumber}`}
              />
            </a>
            <span className={styles.caption}>Page {photo.photoNumber}</span>
          </li>
        );
      })}
    </ol>
  );
}
