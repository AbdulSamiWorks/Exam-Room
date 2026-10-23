import type { TestKind } from '@exam-room/shared';
import { Chip } from '../../../components/Chip';
import type { SubjectOption } from './group-tests-by-subject';
import styles from './SubjectFilter.module.css';

type SubjectFilterProps = {
  options: SubjectOption[];
  selectedSubjectId: number | undefined;
  onSelect: (subjectId: number | undefined) => void;
};

export function SubjectFilter({ options, selectedSubjectId, onSelect }: SubjectFilterProps) {
  return (
    <nav aria-label="Filter tests by subject" className={styles.filter}>
      <Chip
        label="All subjects"
        isSelected={selectedSubjectId === undefined}
        onClick={() => onSelect(undefined)}
      />
      {options.map((option) => (
        <Chip
          key={option.subjectId}
          label={option.label}
          isSelected={option.subjectId === selectedSubjectId}
          onClick={() => onSelect(option.subjectId)}
        />
      ))}
    </nav>
  );
}

const KIND_CHOICES: Array<{ kind: TestKind | undefined; label: string }> = [
  { kind: undefined, label: 'All types' },
  { kind: 'test', label: 'Tests' },
  { kind: 'quiz', label: 'Quizzes' },
];

type KindFilterProps = {
  selectedKind: TestKind | undefined;
  onSelect: (kind: TestKind | undefined) => void;
};

export function KindFilter({ selectedKind, onSelect }: KindFilterProps) {
  return (
    <nav aria-label="Filter tests by type" className={styles.filter}>
      {KIND_CHOICES.map((choice) => (
        <Chip
          key={choice.label}
          label={choice.label}
          isSelected={choice.kind === selectedKind}
          onClick={() => onSelect(choice.kind)}
        />
      ))}
    </nav>
  );
}
