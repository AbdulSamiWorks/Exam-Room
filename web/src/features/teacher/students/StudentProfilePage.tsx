import type { ProgressResponse, StudentPointsHistoryResponse } from '@exam-room/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { getJson } from '../../../api/http-client';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { describeDateTime } from '../../../lib/describe-date-time';
import { ProgressOverview } from '../../progress/ProgressOverview';
import { percentOf } from '../../progress/progress-stats';
import { manageClassPath } from '../manage/manage-paths';
import styles from './StudentProfilePage.module.css';

export function StudentProfilePage() {
  const studentId = Number(useParams().studentId);
  const progressQuery = useQuery({
    queryKey: ['teacher-student-progress', studentId],
    queryFn: () => getJson<ProgressResponse>(`/students/${studentId}/progress`),
  });
  const pointsQuery = useQuery({
    queryKey: ['teacher-student-points', studentId],
    queryFn: () => getJson<StudentPointsHistoryResponse>(`/students/${studentId}/points`),
  });

  if (progressQuery.isPending) return <LoadingScreen />;
  if (progressQuery.isError) {
    return (
      <Page title="Student" backLink={{ to: '/teacher/manage', label: 'Manage' }}>
        <FormError>{progressQuery.error.message}</FormError>
      </Page>
    );
  }

  const { student, results, subjects } = progressQuery.data;
  return (
    <Page
      title={student.name}
      subtitle={`${student.schoolClass.name} · Roll number ${student.rollNumber}`}
      backLink={{
        to: manageClassPath(student.schoolClass.id, 'students'),
        label: student.schoolClass.name,
      }}
    >
      <div className={styles.sections}>
        <ProgressOverview results={results} subjects={subjects} />
        <Panel title="Results">
          {results.length === 0 ? (
            <p className={styles.note}>No marked results yet.</p>
          ) : (
            <ul className={styles.list}>
              {[...results].reverse().map((result) => (
                <li key={result.testCode} className={styles.row}>
                  <span className={styles.title}>{result.testTitle}</span>
                  <span className={styles.value}>
                    {result.marks} / {result.maxMarks} ({percentOf(result)}%)
                  </span>
                  <span className={styles.note}>
                    {result.subjectName} · {describeDateTime(result.date)}
                    {result.isReleased ? '' : ' · not released'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={`Points: ${pointsQuery.data?.total ?? 0}`}>
          {pointsQuery.data?.entries.length === 0 && <p className={styles.note}>No points yet.</p>}
          <ul className={styles.list}>
            {pointsQuery.data?.entries.map((entry) => (
              <li key={entry.id} className={styles.row}>
                <span className={styles.title}>{entry.reason}</span>
                <span className={styles.value}>
                  {entry.points > 0 ? `+${entry.points}` : entry.points}
                </span>
                <span className={styles.note}>{describeDateTime(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Page>
  );
}
