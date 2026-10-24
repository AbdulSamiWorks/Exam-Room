import { classNames } from '../lib/class-names';
import styles from './TabLinks.module.css';

type TabButtonsProps<Value extends string> = {
  label: string;
  tabs: ReadonlyArray<{ value: Value; label: string }>;
  selectedValue: Value;
  onSelect: (value: Value) => void;
  className?: string;
};

export function TabButtons<Value extends string>({
  label,
  tabs,
  selectedValue,
  onSelect,
  className,
}: TabButtonsProps<Value>) {
  return (
    <div role="tablist" aria-label={label} className={classNames(styles.tabs, className)}>
      {tabs.map((tab) => {
        const isSelected = tab.value === selectedValue;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            className={classNames(styles.tab, styles.tabButton, isSelected && styles.activeTab)}
            onClick={() => onSelect(tab.value)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
