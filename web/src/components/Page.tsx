import type { ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './Page.module.css';

type PageProps = {
  title: string;
  subtitle?: string;
  backLink?: { to: string; label: string };
  actions?: ReactNode;
  children?: ReactNode;
};

export function Page({ title, subtitle, backLink, actions, children }: PageProps) {
  return (
    <main className={styles.page}>
      {backLink && (
        <Link to={backLink.to} className={styles.backLink}>
          ← {backLink.label}
        </Link>
      )}
      <div className={styles.header}>
        <div className={styles.headings}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </main>
  );
}

export function PageText({ children }: { children: ReactNode }) {
  return <p className={styles.text}>{children}</p>;
}
