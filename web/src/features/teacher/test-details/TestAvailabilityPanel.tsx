import type { TestSummary } from '@exam-room/shared';
import { useState } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { Panel } from '../../../components/Panel';
import { AvailabilityBadge } from '../tests/AvailabilityBadge';
import { describeAvailability } from '../tests/describe-availability';
import { useCloseTest, useOpenTest } from '../tests/use-tests';
import { ScheduleForm } from './ScheduleForm';
import styles from './TestAvailabilityPanel.module.css';

export function TestAvailabilityPanel({ test }: { test: TestSummary }) {
  const [isEditingTimes, setIsEditingTimes] = useState(false);

  return (
    <Panel title="When students can start">
      <p className={styles.status}>
        <AvailabilityBadge test={test} />
        <span>{describeAvailability(test)}</span>
      </p>
      {isEditingTimes ? (
        <ScheduleForm test={test} onDone={() => setIsEditingTimes(false)} />
      ) : (
        <AvailabilityActions test={test} onEditTimes={() => setIsEditingTimes(true)} />
      )}
      <p className={styles.note}>
        Closing only stops new students from starting. Students who already started keep their full
        time.
      </p>
    </Panel>
  );
}

type AvailabilityActionsProps = {
  test: TestSummary;
  onEditTimes: () => void;
};

function AvailabilityActions({ test, onEditTimes }: AvailabilityActionsProps) {
  const openTest = useOpenTest(test.id);
  const closeTest = useCloseTest(test.id);
  const isBusy = openTest.isPending || closeTest.isPending;
  const error = openTest.error ?? closeTest.error;

  return (
    <>
      {error && <FormError>{error.message}</FormError>}
      <div className={styles.actions}>
        {test.availability === 'open' ? (
          <Button variant="danger" onClick={() => closeTest.mutate()} disabled={isBusy}>
            {closeTest.isPending ? 'Closing…' : 'Close now'}
          </Button>
        ) : (
          <Button onClick={() => openTest.mutate()} disabled={isBusy}>
            {openTest.isPending ? 'Opening…' : 'Open now'}
          </Button>
        )}
        <Button variant="secondary" onClick={onEditTimes} disabled={isBusy}>
          Set times
        </Button>
        {test.availability === 'scheduled' && (
          <Button variant="secondary" onClick={() => closeTest.mutate()} disabled={isBusy}>
            {closeTest.isPending ? 'Cancelling…' : 'Cancel opening'}
          </Button>
        )}
      </div>
    </>
  );
}
