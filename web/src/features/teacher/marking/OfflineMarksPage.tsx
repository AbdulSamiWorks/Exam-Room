import type { OfflineMarkRow, OfflineMarksRequest, OfflineMarksResponse } from '@exam-room/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { getJson, putJson } from '../../../api/http-client';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { testQueryKeys } from '../tests/use-tests';
import { ReleasePanel } from './ReleasePanel';
import { useMarking } from './use-marking';
import styles from './MarkingPage.module.css';

export function OfflineMarksPage() {
  const testId = Number(useParams().testId);
  const queryKey = [...testQueryKeys.detail(testId), 'offline-marks'];
  const marksQuery = useQuery({
    queryKey,
    queryFn: () => getJson<OfflineMarksResponse>(`/tests/${testId}/offline-marks`),
  });
  const markingQuery = useMarking(testId);
  const backLink = { to: `/teacher/tests/${testId}`, label: 'Back to the assignment' };

  if (marksQuery.isPending || markingQuery.isPending) return <LoadingScreen />;
  const error = marksQuery.error ?? markingQuery.error;
  if (error || !marksQuery.data || !markingQuery.data) {
    return (
      <Page title="Marks" backLink={backLink}>
        <FormError>{error?.message ?? 'Something went wrong.'}</FormError>
      </Page>
    );
  }

  return (
    <Page title="Marks" subtitle={`Out of ${marksQuery.data.maxMarks}`} backLink={backLink}>
      <div className={styles.sections}>
        <OfflineMarksForm testId={testId} marks={marksQuery.data} />
        <ReleasePanel testId={testId} marking={markingQuery.data} />
      </div>
    </Page>
  );
}

function OfflineMarksForm({ testId, marks }: { testId: number; marks: OfflineMarksResponse }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => draftOf(marks.students));
  const save = useMutation({
    mutationFn: (request: OfflineMarksRequest) =>
      putJson<OfflineMarksResponse>(`/tests/${testId}/offline-marks`, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: testQueryKeys.detail(testId) }),
  });

  function submit() {
    save.mutate({
      marks: marks.students.map((student) => {
        const text = draft[student.studentId]?.trim() ?? '';
        return { studentId: student.studentId, marks: text === '' ? null : Number(text) };
      }),
    });
  }

  if (marks.students.length === 0) {
    return <p className={styles.note}>The class has no students yet. Add them in Manage.</p>;
  }

  return (
    <Panel title="Enter the marks">
      <p className={styles.note}>Leave a box empty for a student who did not hand it in.</p>
      <ul className={styles.studentList}>
        {marks.students.map((student) => (
          <li key={student.studentId} className={styles.offlineRow}>
            <label className={styles.offlineLabel} htmlFor={`marks-${student.studentId}`}>
              {student.rollNumber} · {student.name}
            </label>
            <input
              id={`marks-${student.studentId}`}
              className={styles.offlineInput}
              type="number"
              inputMode="decimal"
              min={0}
              max={marks.maxMarks}
              step={0.5}
              value={draft[student.studentId] ?? ''}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [student.studentId]: event.target.value }))
              }
            />
          </li>
        ))}
      </ul>
      {save.error && <FormError>{save.error.message}</FormError>}
      {save.isSuccess && <p className={styles.saved}>Marks saved.</p>}
      <Button onClick={submit} disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save marks'}
      </Button>
    </Panel>
  );
}

function draftOf(students: readonly OfflineMarkRow[]): Record<number, string> {
  return Object.fromEntries(
    students.map((student) => [
      student.studentId,
      student.marks === null ? '' : String(student.marks),
    ]),
  );
}
