import type { AllowedExits, ClassSummary, LeaveRule, TestKind } from '@exam-room/shared';
import { ButtonLink } from '../../../components/Button';
import { ChoiceGroup, type Choice } from '../../../components/ChoiceGroup';
import { FormError } from '../../../components/FormError';
import { Panel } from '../../../components/Panel';
import { TextField } from '../../../components/TextField';
import { MANAGE_PATH, manageClassPath } from '../manage/manage-paths';
import { useClassTree } from '../manage/use-classes';
import { ChapterPicker } from './ChapterPicker';
import { ClassSubjectPicker } from './ClassSubjectPicker';
import { testLimits } from './test-limits';
import {
  withChapterToggled,
  withClass,
  withSubject,
  type TestSettingsFormErrors,
  type TestSettingsFormValues,
} from './test-settings-form';
import type { UpdateTestSettings } from './use-test-settings-form';

const KIND_CHOICES: Choice<TestKind>[] = [
  { value: 'test', label: 'Test' },
  { value: 'quiz', label: 'Quiz' },
];

const ALLOWED_EXITS_CHOICES: Choice<AllowedExits>[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
];

const LEAVE_RULE_CHOICES: Choice<LeaveRule>[] = [
  { value: 'lock', label: 'Lock (I can unlock)' },
  { value: 'finish', label: 'Finish the test' },
];

type TestSettingsFieldsProps = {
  values: TestSettingsFormValues;
  errors: TestSettingsFormErrors;
  onChange: UpdateTestSettings;
  areRulesFixed?: boolean;
};

export function TestSettingsFields({
  values,
  errors,
  onChange,
  areRulesFixed = false,
}: TestSettingsFieldsProps) {
  return (
    <>
      <ClassFields values={values} errors={errors} onChange={onChange} />

      <ChoiceGroup
        label="Type"
        choices={KIND_CHOICES}
        selectedValue={values.kind}
        onChange={(kind) => onChange((current) => ({ ...current, kind }))}
      />

      <TextField
        label="Title"
        placeholder="e.g. Chapter 3 Quiz"
        value={values.title}
        maxLength={testLimits.maxTitleLength}
        onChange={(event) => {
          const title = event.target.value;
          onChange((current) => ({ ...current, title }), 'title');
        }}
        errorMessage={errors.title}
      />

      <TextField
        label="Time limit (minutes)"
        type="number"
        inputMode="numeric"
        min={testLimits.minDurationMinutes}
        max={testLimits.maxDurationMinutes}
        value={values.durationMinutes}
        disabled={areRulesFixed}
        onChange={(event) => {
          const durationMinutes = event.target.value;
          onChange((current) => ({ ...current, durationMinutes }), 'durationMinutes');
        }}
        errorMessage={errors.durationMinutes}
      />

      <ChoiceGroup
        label="Allowed exits"
        hint="How many times a student may leave the test before the rule below applies."
        choices={ALLOWED_EXITS_CHOICES}
        selectedValue={values.allowedExits}
        disabled={areRulesFixed}
        onChange={(allowedExits) => onChange((current) => ({ ...current, allowedExits }))}
      />

      <ChoiceGroup
        label="When a student leaves too often"
        hint="Finish the test means the student cannot come back, and you cannot unlock it."
        choices={LEAVE_RULE_CHOICES}
        selectedValue={values.leaveRule}
        disabled={areRulesFixed}
        onChange={(leaveRule) => onChange((current) => ({ ...current, leaveRule }))}
      />
    </>
  );
}

type ClassFieldsProps = Omit<TestSettingsFieldsProps, 'areRulesFixed'>;

function ClassFields({ values, errors, onChange }: ClassFieldsProps) {
  const classTree = useClassTree();

  if (classTree.isPending) return <p>Loading classes…</p>;
  if (classTree.isError) return <FormError>{classTree.error.message}</FormError>;

  const classes = classTree.data;
  if (classes.length === 0) {
    return (
      <Panel title="Add a class first">
        <p>Every test belongs to a subject of a class. Add your class and its subjects first.</p>
        <ButtonLink to={MANAGE_PATH}>Go to Manage</ButtonLink>
      </Panel>
    );
  }

  const classId = values.classId || onlyClassIdOf(classes);
  const chosenSubject = classes
    .flatMap((schoolClass) => schoolClass.subjects)
    .find((subject) => String(subject.id) === values.subjectId);

  return (
    <>
      <ClassSubjectPicker
        classes={classes}
        classId={classId}
        subjectId={values.subjectId}
        onSelectClass={(nextClassId) => onChange((current) => withClass(current, nextClassId))}
        onSelectSubject={(subjectId) =>
          onChange((current) => withSubject({ ...current, classId }, subjectId), 'subjectId')
        }
        errorMessage={errors.subjectId}
      />
      {chosenSubject && (
        <ChapterPicker
          chapters={chosenSubject.chapters}
          selectedChapterIds={values.chapterIds}
          manageLink={manageClassPath(Number(classId))}
          errorMessage={errors.chapterIds}
          onToggle={(chapterId) =>
            onChange((current) => withChapterToggled(current, chapterId), 'chapterIds')
          }
        />
      )}
    </>
  );
}

function onlyClassIdOf(classes: readonly ClassSummary[]): string {
  const [onlyClass, ...otherClasses] = classes;
  return onlyClass && otherClasses.length === 0 ? String(onlyClass.id) : '';
}
