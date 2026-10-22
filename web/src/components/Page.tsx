import type { ReactNode } from 'react';
import styles from './Page.module.css';

type PageProps = {
  title: string;
  children?: ReactNode;
};

export function Page({ title, children }: PageProps) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {children}
    </main>
  );
}

export function PageText({ children }: { children: ReactNode }) {
  return <p className={styles.text}>{children}</p>;
}
