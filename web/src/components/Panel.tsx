import type { ReactNode } from 'react';
import styles from './Panel.module.css';

type PanelProps = {
  title?: string;
  children: ReactNode;
};

export function Panel({ title, children }: PanelProps) {
  return (
    <section className={styles.panel}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {children}
    </section>
  );
}
