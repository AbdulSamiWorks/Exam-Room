import type { StudentProfile, StudentTestCard } from '@exam-room/shared';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page } from '../../components/Page';
import { Panel } from '../../components/Panel';
import { ThemeToggle } from '../../components/ThemeToggle';
import { describeDateTime } from '../../lib/describe-date-time';
import { describeDuration } from '../../lib/describe-test-length';
import { describeStudentTestState, groupStudentTests } from './group-student-tests';
import { studentTestPath } from './student-paths';
import { useStudentHome, useStudentLogout } from './use-student-account';
import styles from './StudentHomePage.module.css';

export function StudentHomePage({ student }: { student: StudentProfile }) {
  const home = useStudentHome();
  const logout = useStudentLogout();

  return (
    <Page
      title={`Hello, ${student.name}`}
      subtitle={`${student.schoolClass.name} · Roll number ${student.rollNumber}`}
      actions={
        <div className={styles.headerActions}>
          <ThemeToggle />
          <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Log out
          </Button>
        </div>
      }
    >
      {home.isPending && <LoadingScreen message="Loading your tests…" />}
      {home.isError && <FormError>{home.error.message}</FormError>}
      {home.data && <TestSections tests={home.data.tests} />}
    </Page>
  );
}

function TestSections({ tests }: { tests: StudentTestCard[] }) {
  const groups = groupStudentTests(tests);

  return (
    <div className={styles.sections}>
      <TestSection title="Open now" emptyMessage="No test is open right now." tests={groups.now} />
      <TestSection title="Upcoming" emptyMessage="No upcoming tests." tests={groups.upcoming} />
      {groups.finished.length > 0 && (
        <TestSection title="Finished" emptyMessage="" tests={groups.finished} />
      )}
    </div>
  );
}

type TestSectionProps = {
  title: string;
  emptyMessage: string;
  tests: StudentTestCard[];
};

function TestSection({ title, emptyMessage, tests }: TestSectionProps) {
  return (
    <Panel title={title}>
      {tests.length === 0 ? (
        <p className={styles.emptyMessage}>{emptyMessage}</p>
      ) : (
        <ul className={styles.testList}>
          {tests.map((test) => (
            <li key={test.code}>
              <StudentTestLink test={test} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function StudentTestLink({ test }: { test: StudentTestCard }) {
  const timing =
    test.availability === 'scheduled'
      ? `Opens ${describeDateTime(test.opensAt)}`
      : describeDuration(test.durationMinutes);

  return (
    <Link to={studentTestPath(test.code)} className={styles.testCard}>
      <span className={styles.testTitle}>{test.title}</span>
      <span className={styles.testDetails}>
        {test.subjectName} · {timing}
      </span>
      <span className={styles.testState}>{describeStudentTestState(test)}</span>
    </Link>
  );
}
