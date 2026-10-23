import { Link, Outlet } from 'react-router';
import { Button } from '../../components/Button';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useLogout } from './auth/use-teacher-session';
import styles from './TeacherLayout.module.css';

export function TeacherLayout() {
  const logout = useLogout();

  return (
    <>
      <header className={styles.header}>
        <Link to="/teacher" className={styles.brand}>
          Exam Room
        </Link>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Log out
          </Button>
        </div>
      </header>
      <Outlet />
    </>
  );
}
