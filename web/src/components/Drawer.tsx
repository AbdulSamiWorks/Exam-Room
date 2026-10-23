import { useEffect, useId, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './Drawer.module.css';

type DrawerProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ title, isOpen, onClose, children }: DrawerProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <Button variant="secondary" size="small" onClick={onClose} autoFocus>
            Close
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}
