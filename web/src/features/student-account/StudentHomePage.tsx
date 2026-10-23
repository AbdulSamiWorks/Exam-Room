import type { ClassLeader, StudentProfile, StudentTestCard } from '@exam-room/shared';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { FormError } from '../../components/FormError';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page } from '../../components/Page';
import { Panel } from '../../components/Panel';
import { ThemeToggle } from '../../components/ThemeToggle';
import { countOf, joinWithAnd } from '../../lib/text';
import { ProgressOverview } from '../progress/ProgressOverview';
import { FingerprintOffer } from './FingerprintOffer';
import { groupStudentTests } from './group-student-tests';
import { InstallAppPanel } from './InstallAppPanel';
import { studentSubjectPath } from './student-paths';
import { StudentTestList } from './StudentTestLink';
import { useStudentHome, useStudentLogout } from './use-student-account';
import { useStudentProgress } from './use-student-progress';
import styles from './StudentHomePage.module.css';

export function StudentHomePage({ student }: { student: StudentProfile }) {
  const home = useStudentHome();
  const progress = useStudentProgress();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <Page
      title={`Hello, ${student.name}`}
      subtitle={`${student.schoolClass.name} · Roll number ${student.rollNumber}`}
      actions={
        <Button variant="secondary" onClick={() => setIsMenuOpen(true)}>
          Menu
        </Button>
      }
    >
      <div className={styles.sections}>
        <FingerprintOffer />
        <InstallAppPanel />
        {home.isPending && <LoadingScreen message="Loading your tests…" />}
        {home.isError && <FormError>{home.error.message}</FormError>}
        {home.data && <TestSections tests={home.data.tests} />}
        {progress.data && (
          <ProgressOverview
            results={progress.data.results}
            subjects={progress.data.subjects}
            subjectPath={studentSubjectPath}
          />
        )}
      </div>
      <Drawer title="My profile" isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)}>
        <ProfileDetails
          student={student}
          points={home.data?.points ?? 0}
          leaders={home.data?.classLeaders ?? []}
        />
      </Drawer>
    </Page>
  );
}

type ProfileDetailsProps = {
  student: StudentProfile;
  points: number;
  leaders: ClassLeader[];
};

function ProfileDetails({ student, points, leaders }: ProfileDetailsProps) {
  const logout = useStudentLogout();
  return (
    <>
      <dl className={styles.profile}>
        <dt>Name</dt>
        <dd>{student.name}</dd>
        <dt>Class</dt>
        <dd>{student.schoolClass.name}</dd>
        <dt>Roll number</dt>
        <dd>{student.rollNumber}</dd>
        <dt>Points</dt>
        <dd>{countOf(points, 'point')}</dd>
        {leaders.length > 0 && (
          <>
            <dt>Class leader</dt>
            <dd>
              {joinWithAnd(leaders.map((leader) => leader.name))} (
              {countOf(leaders[0]?.points ?? 0, 'point')})
            </dd>
          </>
        )}
      </dl>
      <ThemeToggle />
      <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
        Log out
      </Button>
    </>
  );
}

function TestSections({ tests }: { tests: StudentTestCard[] }) {
  const groups = groupStudentTests(tests);

  return (
    <>
      <TestSection title="Open now" emptyMessage="No test is open right now." tests={groups.now} />
      <TestSection title="Upcoming" emptyMessage="No upcoming tests." tests={groups.upcoming} />
      {groups.finished.length > 0 && (
        <TestSection title="Finished" emptyMessage="" tests={groups.finished.slice(0, 5)} />
      )}
    </>
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
        <StudentTestList tests={tests} />
      )}
    </Panel>
  );
}
