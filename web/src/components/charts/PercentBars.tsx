import type { ReactNode } from 'react';
import styles from './Charts.module.css';

export type PercentBarItem = {
  key: string | number;
  label: ReactNode;
  percent: number | null;
  detail: string;
};

const BAR_HEIGHT = 8;

export function PercentBars({ items }: { items: readonly PercentBarItem[] }) {
  return (
    <ul className={styles.bars}>
      {items.map((item) => (
        <li key={item.key} className={styles.barRow}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>{item.label}</span>
            <span className={styles.barValue}>
              {item.percent === null ? '–' : `${item.percent}%`}
            </span>
          </div>
          <svg
            className={styles.bar}
            viewBox={`0 0 100 ${BAR_HEIGHT}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect className={styles.barTrack} width="100" height={BAR_HEIGHT} rx="4" />
            {item.percent !== null && (
              <rect className={styles.barFill} width={item.percent} height={BAR_HEIGHT} rx="4" />
            )}
          </svg>
          <span className={styles.barDetail}>{item.detail}</span>
        </li>
      ))}
    </ul>
  );
}
