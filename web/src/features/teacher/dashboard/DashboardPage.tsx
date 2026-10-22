import { useSearchParams } from 'react-router';
import { ButtonLink } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { useSubjects } from '../subjects/use-subjects';
import { useTestList } from '../tests/use-tests';
import { groupTestsBySubject } from './group-tests-by-subject';
import { SubjectFilter } from './SubjectFilter';
import { TestCard } from './TestCard';
import styles from './DashboardPage.module.css';

const SUBJECT_FILTER_PARAM = 'subject';
const NEW_TEST_PATH = '/teacher/tests/new';

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSubjectId = parseSubjectId(searchParams.get(SUBJECT_FILTER_PARAM));
  const subjects = useSubjects();

  function selectSubject(subjectId: number | undefined) {
    const nextSearchParams = new URLSearchParams();
    if (subjectId !== undefined) nextSearchParams.set(SUBJECT_FILTER_PARAM, `${subjectId}`);
    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <Page title="Tests" actions={<ButtonLink to={NEW_TEST_PATH}>+ New test</ButtonLink>}>
      {subjects.data && subjects.data.length > 0 && (
        <SubjectFilter
          subjects={subjects.data}
          selectedSubjectId={selectedSubjectId}
          onSelect={selectSubject}
        />
      )}
      <TestList subjectId={selectedSubjectId} />
    </Page>
  );
}

function TestList({ subjectId }: { subjectId: number | undefined }) {
  const testList = useTestList(subjectId);

  if (testList.isPending) return <LoadingScreen message="Loading tests…" />;
  if (testList.isError) return <FormError>{testList.error.message}</FormError>;

  if (testList.data.length === 0) {
    const isFiltered = subjectId !== undefined;
    return (
      <Panel>
        <p className={styles.emptyMessage}>
          {isFiltered ? 'No tests in this subject yet.' : 'No tests yet. Create your first test.'}
        </p>
        <ButtonLink to={NEW_TEST_PATH}>+ New test</ButtonLink>
      </Panel>
    );
  }

  return (
    <div className={styles.groups}>
      {groupTestsBySubject(testList.data).map(({ subject, tests }) => (
        <section key={subject.id} className={styles.group}>
          <h2 className={styles.subjectName}>{subject.name}</h2>
          <ul className={styles.testList}>
            {tests.map((test) => (
              <li key={test.id}>
                <TestCard test={test} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function parseSubjectId(value: string | null): number | undefined {
  const subjectId = Number(value);
  return Number.isInteger(subjectId) && subjectId > 0 ? subjectId : undefined;
}
