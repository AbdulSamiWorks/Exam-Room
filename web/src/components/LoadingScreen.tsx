import styles from './LoadingScreen.module.css';

export function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className={styles.loadingScreen} role="status">
      {message}
    </div>
  );
}
