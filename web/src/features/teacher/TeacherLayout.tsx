import { Link, Outlet, useLocation } from 'react-router';
import { Button } from '../../components/Button';
import { TabLinks, type TabLink } from '../../components/TabLinks';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useLogout } from './auth/use-teacher-session';
import { MANAGE_PATH } from './manage/manage-paths';
import styles from './TeacherLayout.module.css';

const TESTS_PATH = '/teacher';

const TEACHER_SECTIONS: readonly TabLink[] = [
  { to: TESTS_PATH, label: 'Tests' },
  { to: MANAGE_PATH, label: 'Manage' },
];

function activeSectionPath(pathname: string): string {
  return pathname.startsWith(MANAGE_PATH) ? MANAGE_PATH : TESTS_PATH;
}

export function TeacherLayout() {
  const logout = useLogout();
  const activePath = activeSectionPath(useLocation().pathname);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.topRow}>
          <Link to={TESTS_PATH} className={styles.brand}>
            Exam Room
          </Link>
          <div className={styles.headerActions}>
            <ThemeToggle />
            <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
              Log out
            </Button>
          </div>
        </div>
        <TabLinks
          label="Teacher sections"
          tabs={TEACHER_SECTIONS}
          activeTo={activePath}
          className={styles.sections}
        />
      </header>
      <Outlet />
    </>
  );
}
