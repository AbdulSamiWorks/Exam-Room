import type { AttemptResult, TestSummary } from '@exam-room/shared';
import { Link, useParams } from 'react-router';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { describeDateTime } from '../../../lib/describe-date-time';
import { describeDuration } from '../../../lib/describe-test-length';
import { useTest } from '../tests/use-tests';
import {
  describeAwayTime,
  describeClockTime,
  describeExits,
  describeResultStatus,
  sortByRollNumber,
} from './describe-result';
import { describeTotalMarks } from './results-csv';
import { useTestResults } from './use-results';
import styles from './PrintResultsPage.module.css';

export function PrintResultsPage() {
  const testId = Number(useParams().testId);
  const testQuery = useTest(testId);
  const resultsQuery = useTestResults(testId);

  if (testQuery.isPending || resultsQuery.isPending) return <LoadingScreen />;
  if (testQuery.isError) return <PrintError message={testQuery.error.message} />;
  if (resultsQuery.isError) return <PrintError message={resultsQuery.error.message} />;

  return (
    <PrintableResults
      test={testQuery.data}
      results={resultsQuery.data.attempts}
      printedAt={resultsQuery.data.serverTime}
    />
  );
}

function PrintError({ message }: { message: string }) {
  return (
    <main className={styles.page}>
      <FormError>{message}</FormError>
    </main>
  );
}

type PrintableResultsProps = {
  test: TestSummary;
  results: AttemptResult[];
  printedAt: number;
};

function PrintableResults({ test, results, printedAt }: PrintableResultsProps) {
  const hasMarks = test.maxMarks !== null && test.maxMarks > 0;
  const details = [
    test.schoolClass.name,
    test.subject.name,
    describeDuration(test.durationMinutes),
    `Printed ${describeDateTime(printedAt)}`,
  ].join(' · ');

  return (
    <main className={styles.page}>
      <div className={styles.toolbar}>
        <Link to={`/teacher/tests/${test.id}`}>← Back to the test</Link>
        <Button onClick={() => window.print()}>Print</Button>
      </div>

      <h1 className={styles.title}>{test.title}</h1>
      <p className={styles.details}>{details}</p>

      {results.length === 0 ? (
        <p>No student has started this test.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Roll no.</th>
              <th>Name</th>
              <th>Status</th>
              <th>Started</th>
              <th>Finished</th>
              <th>Exits</th>
              <th>Away</th>
              {hasMarks && <th>Marks /{test.maxMarks}</th>}
            </tr>
          </thead>
          <tbody>
            {sortByRollNumber(results).map((result, index) => (
              <tr key={result.id}>
                <td>{index + 1}</td>
                <td>{result.rollNumber}</td>
                <td>{result.studentName}</td>
                <td>{describeResultStatus(result).label}</td>
                <td>{describeClockTime(result.startedAt)}</td>
                <td>{describeClockTime(result.finishedAt)}</td>
                <td>{describeExits(result)}</td>
                <td>{describeAwayTime(result.awayMs)}</td>
                {hasMarks && <td>{describeTotalMarks(result)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
