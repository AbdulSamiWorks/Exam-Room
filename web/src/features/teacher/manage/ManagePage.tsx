import type { ClassSummary } from '@exam-room/shared';
import { Link } from 'react-router';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { classLimits } from './manage-limits';
import { describeClassContents } from './manage-rules';
import { manageClassPath } from './manage-paths';
import { NameForm } from './NameForm';
import { useClassTree, useCreateClass } from './use-classes';
import styles from './ManagePage.module.css';

export function ManagePage() {
  const classTree = useClassTree();
  const createClass = useCreateClass();

  return (
    <Page title="Manage" subtitle="Classes, subjects, chapters and students">
      <div className={styles.content}>
        <Panel title="Add a class">
          <NameForm
            label="Class name"
            placeholder="e.g. Class 9"
            maxLength={classLimits.maxNameLength}
            submitLabel="Add class"
            busyLabel="Adding…"
            clearsAfterSubmit
            onSubmit={(name) => createClass.mutateAsync(name)}
          />
        </Panel>

        {classTree.isPending && <LoadingScreen message="Loading classes…" />}
        {classTree.isError && <FormError>{classTree.error.message}</FormError>}
        {classTree.isSuccess && <ClassList classes={classTree.data} />}
      </div>
    </Page>
  );
}

function ClassList({ classes }: { classes: ClassSummary[] }) {
  if (classes.length === 0) {
    return <p className={styles.emptyMessage}>No classes yet. Add your first class above.</p>;
  }

  return (
    <ul className={styles.classList}>
      {classes.map((schoolClass) => (
        <li key={schoolClass.id}>
          <Link to={manageClassPath(schoolClass.id)} className={styles.classCard}>
            <span className={styles.className}>{schoolClass.name}</span>
            <span className={styles.details}>{describeClassContents(schoolClass)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
