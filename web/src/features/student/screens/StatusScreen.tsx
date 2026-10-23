import type { ReactNode } from 'react';
import { classNames } from '../../../lib/class-names';
import styles from './StatusScreen.module.css';

type StatusTone = 'success' | 'danger' | 'neutral';

type StatusScreenProps = {
  tone: StatusTone;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  isOverlay?: boolean;
};

export function StatusScreen({ tone, title, children, actions, isOverlay }: StatusScreenProps) {
  return (
    <main
      className={classNames(styles.screen, styles[tone], isOverlay && styles.overlay)}
      role={isOverlay ? 'alertdialog' : undefined}
      aria-modal={isOverlay ? true : undefined}
      aria-labelledby="status-screen-title"
    >
      <div className={styles.content}>
        <h1 id="status-screen-title" className={styles.title}>
          {title}
        </h1>
        {children && <div className={styles.message}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </main>
  );
}
