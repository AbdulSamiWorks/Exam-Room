import { useEffect, useMemo } from 'react';
import styles from './PhotoAnswersPanel.module.css';

export function PendingPhotoPreview({ photo }: { photo: Blob }) {
  const url = useMemo(() => URL.createObjectURL(photo), [photo]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img className={styles.thumbnail} src={url} alt="Photo waiting to be sent" />;
}
