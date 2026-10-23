import type { TestSummary } from '@exam-room/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/Button';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Panel } from '../../../components/Panel';
import { useDeleteTest } from '../tests/use-tests';
import styles from './DeleteTestPanel.module.css';

export function DeleteTestPanel({ test }: { test: TestSummary }) {
  const navigate = useNavigate();
  const deleteTest = useDeleteTest(test.id, () => navigate('/teacher', { replace: true }));
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <Panel title="Delete test">
      <p className={styles.note}>Removes the paper and all results. This cannot be undone.</p>
      <Button variant="secondary" onClick={() => setIsConfirming(true)}>
        Delete test
      </Button>
      {isConfirming && (
        <ConfirmDialog
          title={`Delete “${test.title}”?`}
          message="The paper and all results will be deleted for good. Students who are writing it now will lose the paper."
          confirmLabel="Delete test"
          busyLabel="Deleting…"
          isBusy={deleteTest.isPending}
          errorMessage={deleteTest.error?.message}
          onCancel={() => setIsConfirming(false)}
          onConfirm={() => deleteTest.mutate()}
        />
      )}
    </Panel>
  );
}
