import type { StudentWithPin } from '@exam-room/shared';
import { useEffect, useRef } from 'react';
import { Button } from '../../../components/Button';
import { Panel } from '../../../components/Panel';
import { useCopyToClipboard } from '../../../lib/use-copy-to-clipboard';
import { pinListText } from './manage-rules';
import styles from './StudentsSection.module.css';

type NewPinsPanelProps = {
  schoolClassName: string;
  studentsWithPins: StudentWithPin[];
  onDone: () => void;
};

export function NewPinsPanel({ schoolClassName, studentsWithPins, onDone }: NewPinsPanelProps) {
  const { isCopied, copy } = useCopyToClipboard();
  const panelRef = useRef<HTMLDivElement>(null);
  const isOneStudent = studentsWithPins.length === 1;
  const copyLabel = isOneStudent ? 'Copy PIN' : 'Copy all PINs';

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [studentsWithPins]);

  return (
    <div ref={panelRef} className={styles.newPins}>
      <Panel title={isOneStudent ? 'New PIN' : 'New PINs'}>
        <p className={styles.warning}>
          Copy or write down {isOneStudent ? 'this PIN' : 'these PINs'} now. They are shown only
          once. You can reset a PIN later.
        </p>
        <ul className={styles.pinList}>
          {studentsWithPins.map(({ student, pin }) => (
            <li key={student.id} className={styles.pinRow}>
              <span className={styles.rollNumber}>{student.rollNumber}</span>
              <span className={styles.studentName}>{student.name}</span>
              <span className={styles.pin}>{pin}</span>
            </li>
          ))}
        </ul>
        <div className={styles.pinActions}>
          <Button onClick={() => void copy(pinListText(schoolClassName, studentsWithPins))}>
            {isCopied ? 'Copied' : copyLabel}
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Done
          </Button>
        </div>
      </Panel>
    </div>
  );
}
