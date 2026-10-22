import type { ReactNode } from 'react';
import styles from './FormError.module.css';

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p className={styles.formError} role="alert">
      {children}
    </p>
  );
}
