import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { describeDateTime } from '../../../lib/describe-date-time';
import { shrinkImage } from '../../../lib/shrink-image';
import { fetchAnswerPhotos, removeAnswerPhoto } from '../student-api';
import { addPhoto, usePhotoOutbox } from './photo-outbox';
import { PendingPhotoPreview } from './PendingPhotoPreview';
import styles from './PhotoAnswersPanel.module.css';

const MAX_PHOTOS = 10;
const ANSWER_PHOTO = { maxSidePx: 1600, type: 'image/jpeg', quality: 0.82 } as const;

type PhotoAnswersPanelProps = {
  testCode: string;
  attemptToken: string;
};

export function PhotoAnswersPanel({ testCode, attemptToken }: PhotoAnswersPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = ['answer-photos', testCode];
  const photosQuery = useQuery({ queryKey, queryFn: () => fetchAnswerPhotos(attemptToken) });
  const outbox = usePhotoOutbox(testCode);
  const [isPreparing, setIsPreparing] = useState(false);
  const [problem, setProblem] = useState<string>();
  const pendingCount = outbox.pending.length;

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['answer-photos', testCode] });
  }, [pendingCount, queryClient, testCode]);

  if (photosQuery.isPending) return <p className={styles.note}>Loading your photos…</p>;
  if (photosQuery.isError) return <FormError>{photosQuery.error.message}</FormError>;

  const { photos, photosOpenUntil, serverTime } = photosQuery.data;
  const isOpen = photosOpenUntil !== null && serverTime < photosOpenUntil;
  const freeSlots = MAX_PHOTOS - photos.length - pendingCount;

  async function choosePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].slice(0, freeSlots);
    event.target.value = '';
    setProblem(undefined);
    setIsPreparing(true);
    try {
      for (const file of files) {
        await addPhoto(testCode, attemptToken, await shrinkImage(file, ANSWER_PHOTO));
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'The photo could not be used.');
    } finally {
      setIsPreparing(false);
    }
  }

  async function removePhoto(clientPhotoId: string) {
    await removeAnswerPhoto(attemptToken, clientPhotoId).catch((error: unknown) =>
      setProblem(error instanceof Error ? error.message : 'The photo could not be removed.'),
    );
    await queryClient.invalidateQueries({ queryKey });
  }

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Photos of your written answers</h2>
      {isOpen ? (
        <p className={styles.note}>
          Take a clear photo of each page of your written answers, in good light. You can add up to{' '}
          {MAX_PHOTOS} photos until {describeDateTime(photosOpenUntil)}.
        </p>
      ) : (
        <p className={styles.note}>The time for adding photos is over.</p>
      )}

      {photos.length > 0 && (
        <ul className={styles.savedList}>
          {photos.map((photo) => (
            <li key={photo.clientPhotoId} className={styles.savedPhoto}>
              <span>Photo {photo.photoNumber} saved ✓</span>
              {isOpen && (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => void removePhoto(photo.clientPhotoId)}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {pendingCount > 0 && (
        <div className={styles.pendingList}>
          {outbox.pending.map((photo) => (
            <PendingPhotoPreview key={photo.clientPhotoId} photo={photo.photo} />
          ))}
          <p className={styles.note}>
            {outbox.sendingState === 'offline'
              ? 'No internet. The photos are kept on this phone and sent by themselves.'
              : 'Sending…'}
          </p>
        </div>
      )}

      {[...outbox.problems, ...(problem ? [problem] : [])].map((message) => (
        <FormError key={message}>{message}</FormError>
      ))}

      {isOpen && freeSlots > 0 && (
        <label className={styles.takePhoto}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className={styles.fileInput}
            disabled={isPreparing}
            onChange={(event) => void choosePhotos(event)}
          />
          {isPreparing ? 'Preparing…' : 'Take a photo'}
        </label>
      )}
    </section>
  );
}
