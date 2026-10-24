import type { ClassLeader, StudentProfile, StudentTestCard } from '@exam-room/shared';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Drawer } from '../../components/Drawer';
import { FormError } from '../../components/FormError';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page } from '../../components/Page';
import { Panel } from '../../components/Panel';
import { ThemeToggle } from '../../components/ThemeToggle';
import { classNames } from '../../lib/class-names';
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
        {home.isPending && <LoadingScreen message="Loading your tests…" />}
        {home.isError && <FormError>{home.error.message}</FormError>}
        {home.data && <TestSections tests={home.data.tests} points={home.data.points} />}
        {progress.data && (
          <ProgressOverview
            results={progress.data.results}
            subjects={progress.data.subjects}
            subjectPath={studentSubjectPath}
          />
        )}
        <FingerprintOffer />
        <InstallAppPanel />
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
      {logout.error && <FormError>{logout.error.message}</FormError>}
      <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
        {logout.isPending ? 'Logging out…' : 'Log out'}
      </Button>
    </>
  );
}

const RECENT_RESULT_COUNT = 5;

function TestSections({ tests, points }: { tests: StudentTestCard[]; points: number }) {
  const groups = groupStudentTests(tests);
  const [isShowingAllResults, setIsShowingAllResults] = useState(false);
  const shownResults = isShowingAllResults
    ? groups.finished
    : groups.finished.slice(0, RECENT_RESULT_COUNT);

  return (
    <>
      <dl className={styles.summaryTiles}>
        <SummaryTile label="Open now" value={groups.now.length} className={styles.openTile} />
        <SummaryTile label="Finished" value={groups.finished.length} className={styles.doneTile} />
        <SummaryTile label="Points" value={points} />
      </dl>
      <Panel title="Open now">
        {groups.now.length === 0 ? (
          <p className={styles.emptyMessage}>No test is open right now. Well done!</p>
        ) : (
          <StudentTestList tests={groups.now} />
        )}
      </Panel>
      {groups.upcoming.length > 0 && (
        <Panel title="Coming up">
          <StudentTestList tests={groups.upcoming} />
        </Panel>
      )}
      {groups.finished.length > 0 && (
        <Panel title="Results">
          <StudentTestList tests={shownResults} />
          {groups.finished.length > RECENT_RESULT_COUNT && (
            <Button
              variant="secondary"
              size="small"
              className={styles.showAll}
              onClick={() => setIsShowingAllResults((current) => !current)}
            >
              {isShowingAllResults ? 'Show fewer' : `Show all (${groups.finished.length})`}
            </Button>
          )}
        </Panel>
      )}
    </>
  );
}

type SummaryTileProps = {
  label: string;
  value: number;
  className?: string;
};

function SummaryTile({ label, value, className }: SummaryTileProps) {
  return (
    <div className={classNames(styles.summaryTile, className)}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
