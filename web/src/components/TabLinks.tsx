import { Link } from 'react-router';
import { classNames } from '../lib/class-names';
import styles from './TabLinks.module.css';

export type TabLink = {
  to: string;
  label: string;
};

type TabLinksProps = {
  label: string;
  tabs: readonly TabLink[];
  activeTo: string;
  replace?: boolean;
  className?: string;
};

export function TabLinks({ label, tabs, activeTo, replace = false, className }: TabLinksProps) {
  return (
    <nav aria-label={label} className={classNames(styles.tabs, className)}>
      {tabs.map((tab) => {
        const isActive = tab.to === activeTo;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            replace={replace}
            aria-current={isActive ? 'page' : undefined}
            className={classNames(styles.tab, isActive && styles.activeTab)}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
