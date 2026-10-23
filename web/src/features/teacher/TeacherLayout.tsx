import { Link, Outlet, useLocation } from 'react-router';
import { Button } from '../../components/Button';
import { ThemeToggle } from '../../components/ThemeToggle';
import { classNames } from '../../lib/class-names';
import { useLogout } from './auth/use-teacher-session';
import { MANAGE_PATH } from './manage/manage-paths';
import styles from './TeacherLayout.module.css';

const TEACHER_SECTIONS = [
  { to: '/teacher', label: 'Tests' },
  { to: MANAGE_PATH, label: 'Manage' },
];

function activeSectionPath(pathname: string): string {
  return pathname.startsWith(MANAGE_PATH) ? MANAGE_PATH : '/teacher';
}

export function TeacherLayout() {
  const logout = useLogout();
  const activePath = activeSectionPath(useLocation().pathname);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.topRow}>
          <Link to="/teacher" className={styles.brand}>
            Exam Room
          </Link>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
              Log out
            </Button>
          </div>
        </div>
        <nav aria-label="Teacher sections" className={styles.sections}>
          {TEACHER_SECTIONS.map((section) => (
            <Link
              key={section.to}
              to={section.to}
              aria-current={section.to === activePath ? 'page' : undefined}
              className={classNames(
                styles.sectionLink,
                section.to === activePath && styles.activeSection,
              )}
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </header>
      <Outlet />
    </>
  );
}
