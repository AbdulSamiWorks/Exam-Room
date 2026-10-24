import type { ClassSummary } from '@exam-room/shared';
import { useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { TabLinks } from '../../../components/TabLinks';
import { useConfirmation } from '../../../components/use-confirmation';
import { classLimits } from './manage-limits';
import { classSectionOf, MANAGE_PATH, manageClassPath } from './manage-paths';
import { describeClassContents, describeClassDeletion, isEmptyClass } from './manage-rules';
import { NameForm } from './NameForm';
import { PointsSection } from './PointsSection';
import { StudentsSection } from './StudentsSection';
import { SubjectsSection } from './SubjectsSection';
import { useClassTree, useDeleteClass, useRenameClass } from './use-classes';
import styles from './ClassPage.module.css';

const BACK_TO_CLASSES = { to: MANAGE_PATH, label: 'All classes' };
const TEACHER_PAGES_PREFIX = '/teacher/';

function useBackLink() {
  const backTo: unknown = (useLocation().state as { backTo?: unknown } | null)?.backTo;
  const isTeacherPage = typeof backTo === 'string' && backTo.startsWith(TEACHER_PAGES_PREFIX);
  return isTeacherPage ? { to: backTo, label: 'Back to the test' } : BACK_TO_CLASSES;
}

export function ClassPage() {
  const classId = Number(useParams().classId);
  const classTree = useClassTree();

  if (classTree.isPending) return <LoadingScreen />;

  if (classTree.isError) {
    return (
      <Page title="Class" backLink={BACK_TO_CLASSES}>
        <FormError>{classTree.error.message}</FormError>
      </Page>
    );
  }

  const schoolClass = classTree.data.find((candidate) => candidate.id === classId);
  if (!schoolClass) {
    return (
      <Page title="Class not found" backLink={BACK_TO_CLASSES}>
        <p>This class does not exist any more.</p>
      </Page>
    );
  }

  return <ClassView schoolClass={schoolClass} classes={classTree.data} />;
}

type ClassViewProps = {
  schoolClass: ClassSummary;
  classes: ClassSummary[];
};

function ClassView({ schoolClass, classes }: ClassViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = classSectionOf(searchParams);
  const [isRenaming, setIsRenaming] = useState(false);
  const backLink = useBackLink();
  const renameClass = useRenameClass(schoolClass.id);
  const deleteClass = useDeleteClass(schoolClass.id, () =>
    navigate(MANAGE_PATH, { replace: true }),
  );
  const { askToConfirm, confirmationDialog } = useConfirmation();

  function confirmDelete() {
    const isEmpty = isEmptyClass(schoolClass);
    askToConfirm({
      title: `Delete ${schoolClass.name}?`,
      message: describeClassDeletion(schoolClass),
      confirmLabel: isEmpty ? 'Delete class' : 'Delete everything',
      busyLabel: 'Deleting…',
      typedConfirmation: isEmpty ? undefined : schoolClass.name,
      onConfirm: () => deleteClass.mutateAsync(!isEmpty),
    });
  }

  const sectionTabs = [
    {
      to: manageClassPath(schoolClass.id, 'subjects'),
      label: `Subjects (${schoolClass.subjects.length})`,
    },
    {
      to: manageClassPath(schoolClass.id, 'students'),
      label: `Students (${schoolClass.studentCount})`,
    },
    { to: manageClassPath(schoolClass.id, 'points'), label: 'Points' },
  ];

  return (
    <Page
      title={schoolClass.name}
      subtitle={describeClassContents(schoolClass)}
      backLink={backLink}
      actions={
        !isRenaming && (
          <div className={styles.headerActions}>
            <Button variant="secondary" size="small" onClick={() => setIsRenaming(true)}>
              Rename
            </Button>
            <Button variant="secondary" size="small" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        )
      }
    >
      <div className={styles.content}>
        {isRenaming && (
          <Panel title="Rename the class">
            <NameForm
              label="Class name"
              initialName={schoolClass.name}
              maxLength={classLimits.maxNameLength}
              submitLabel="Save"
              busyLabel="Saving…"
              autoFocus
              onSubmit={async (name) => {
                await renameClass.mutateAsync(name);
                setIsRenaming(false);
              }}
              onCancel={() => setIsRenaming(false)}
            />
          </Panel>
        )}

        <TabLinks
          label={`Parts of ${schoolClass.name}`}
          tabs={sectionTabs}
          activeTo={manageClassPath(schoolClass.id, section)}
          replace
          className={styles.sectionTabs}
        />

        {section === 'subjects' && <SubjectsSection schoolClass={schoolClass} classes={classes} />}
        {section === 'students' && <StudentsSection schoolClass={schoolClass} classes={classes} />}
        {section === 'points' && <PointsSection schoolClass={schoolClass} />}
      </div>
      {confirmationDialog}
    </Page>
  );
}
