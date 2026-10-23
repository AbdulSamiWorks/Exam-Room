import { ButtonLink } from '../../components/Button';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page, PageText } from '../../components/Page';
import { ThemeToggle } from '../../components/ThemeToggle';
import { StudentHomePage } from '../student-account/StudentHomePage';
import { STUDENT_LOGIN_PATH } from '../student-account/student-paths';
import { useStudentSession } from '../student-account/use-student-account';
import styles from './HomePage.module.css';

export function HomePage() {
  const session = useStudentSession();

  if (session.isPending) return <LoadingScreen />;
  if (session.data) return <StudentHomePage student={session.data} />;

  return (
    <Page title="Exam Room" actions={<ThemeToggle />}>
      <PageText>Students: log in with your class, roll number and PIN.</PageText>
      <div className={styles.actions}>
        <ButtonLink to={STUDENT_LOGIN_PATH} size="large" fullWidth>
          Student login
        </ButtonLink>
        <ButtonLink to="/teacher" variant="secondary" fullWidth>
          Teacher login
        </ButtonLink>
      </div>
    </Page>
  );
}
