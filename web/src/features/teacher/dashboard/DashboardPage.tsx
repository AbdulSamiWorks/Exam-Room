import type { TestKind } from '@exam-room/shared';
import { useSearchParams } from 'react-router';
import { ButtonLink } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { subjectOptionsOf } from '../manage/subject-options';
import { useClassTree } from '../manage/use-classes';
import { useTestList } from '../tests/use-tests';
import { groupTestsBySubject, testsOfKind } from './group-tests-by-subject';
import { KindFilter, SubjectFilter } from './SubjectFilter';
import { TestCard } from './TestCard';
import styles from './DashboardPage.module.css';

const SUBJECT_FILTER_PARAM = 'subject';
const KIND_FILTER_PARAM = 'type';
const NEW_TEST_PATH = '/teacher/tests/new';
const TEST_KINDS: readonly TestKind[] = ['test', 'quiz', 'assignment'];

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSubjectId = parseSubjectId(searchParams.get(SUBJECT_FILTER_PARAM));
  const selectedKind = parseKind(searchParams.get(KIND_FILTER_PARAM));
  const classTree = useClassTree();
  const classes = classTree.data ?? [];
  const subjectOptions = subjectOptionsOf(classes);

  function changeFilter(param: string, value: string | undefined) {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (value === undefined) nextSearchParams.delete(param);
    else nextSearchParams.set(param, value);
    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <Page title="Tests" actions={<ButtonLink to={NEW_TEST_PATH}>+ New test</ButtonLink>}>
      {subjectOptions.length > 0 && (
        <SubjectFilter
          options={subjectOptions}
          selectedSubjectId={selectedSubjectId}
          onSelect={(subjectId) => changeFilter(SUBJECT_FILTER_PARAM, subjectId?.toString())}
        />
      )}
      <KindFilter
        selectedKind={selectedKind}
        onSelect={(kind) => changeFilter(KIND_FILTER_PARAM, kind)}
      />
      <TestList
        subjectId={selectedSubjectId}
        kind={selectedKind}
        showsClassName={classes.length > 1}
      />
    </Page>
  );
}

type TestListProps = {
  subjectId: number | undefined;
  kind: TestKind | undefined;
  showsClassName: boolean;
};

function TestList({ subjectId, kind, showsClassName }: TestListProps) {
  const testList = useTestList(subjectId);

  if (testList.isPending) return <LoadingScreen message="Loading tests…" />;
  if (testList.isError) return <FormError>{testList.error.message}</FormError>;

  const tests = testsOfKind(testList.data, kind);
  if (tests.length === 0) {
    const isFiltered = subjectId !== undefined || kind !== undefined;
    return (
      <Panel>
        <p className={styles.emptyMessage}>
          {isFiltered ? 'No tests match this filter.' : 'No tests yet. Create your first test.'}
        </p>
        <ButtonLink to={NEW_TEST_PATH}>+ New test</ButtonLink>
      </Panel>
    );
  }

  return (
    <div className={styles.groups}>
      {groupTestsBySubject(tests, showsClassName).map((group) => (
        <section key={group.subjectId} className={styles.group}>
          <h2 className={styles.subjectName}>{group.heading}</h2>
          <ul className={styles.testList}>
            {group.tests.map((test) => (
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

function parseKind(value: string | null): TestKind | undefined {
  return TEST_KINDS.find((kind) => kind === value);
}
