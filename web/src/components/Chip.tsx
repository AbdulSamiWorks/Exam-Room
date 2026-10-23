import { classNames } from '../lib/class-names';
import styles from './Chip.module.css';

type ChipProps = {
  label: string;
  isSelected: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function Chip({ label, isSelected, disabled = false, onClick }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={classNames(styles.chip, isSelected && styles.selected)}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
