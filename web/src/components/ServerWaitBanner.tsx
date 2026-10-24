import { useSyncExternalStore } from 'react';
import { isWaitingForServer, subscribeToServerWait } from '../api/server-wait';
import styles from './ServerWaitBanner.module.css';

export function ServerWaitBanner() {
  const isWaiting = useSyncExternalStore(subscribeToServerWait, isWaitingForServer);
  if (!isWaiting) return null;
  return (
    <p className={styles.banner} role="status">
      <span className={styles.dot} aria-hidden="true" />
      Waiting for the server. If it was asleep, this takes up to a minute. It finishes by itself, no
      need to tap again.
    </p>
  );
}
