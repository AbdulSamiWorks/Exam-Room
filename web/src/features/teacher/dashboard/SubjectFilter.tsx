import type { Subject } from '@exam-room/shared';
import { classNames } from '../../../lib/class-names';
import styles from './SubjectFilter.module.css';

type SubjectFilterProps = {
  subjects: Subject[];
  selectedSubjectId: number | undefined;
  onSelect: (subjectId: number | undefined) => void;
};

export function SubjectFilter({ subjects, selectedSubjectId, onSelect }: SubjectFilterProps) {
  return (
    <nav aria-label="Filter tests by subject" className={styles.filter}>
      <FilterChip
        label="All subjects"
        isSelected={selectedSubjectId === undefined}
        onClick={() => onSelect(undefined)}
      />
      {subjects.map((subject) => (
        <FilterChip
          key={subject.id}
          label={subject.name}
          isSelected={subject.id === selectedSubjectId}
          onClick={() => onSelect(subject.id)}
        />
      ))}
    </nav>
  );
}

type FilterChipProps = {
  label: string;
  isSelected: boolean;
  onClick: () => void;
};

function FilterChip({ label, isSelected, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={classNames(styles.chip, isSelected && styles.selected)}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
