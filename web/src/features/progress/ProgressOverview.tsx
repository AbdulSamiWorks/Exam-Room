import type { ProgressResult, ProgressSubject } from '@exam-room/shared';
import { Link } from 'react-router';
import { PercentBars } from '../../components/charts/PercentBars';
import { ScoreLineChart } from '../../components/charts/ScoreLineChart';
import { Panel } from '../../components/Panel';
import { countOf } from '../../lib/text';
import { scoreTimeline, subjectSummaries, summarizeProgress, type Trend } from './progress-stats';
import styles from './ProgressOverview.module.css';

const TREND_LABELS: Record<Trend, string> = {
  up: 'Getting better',
  down: 'Going down',
  steady: 'Steady',
};

type ProgressOverviewProps = {
  results: ProgressResult[];
  subjects: ProgressSubject[];
  subjectPath?: (subjectId: number) => string;
};

export function ProgressOverview({ results, subjects, subjectPath }: ProgressOverviewProps) {
  const summary = summarizeProgress(results, subjects);
  const subjectRows = subjectSummaries(results, subjects);

  return (
    <>
      <Panel title="Progress">
        {summary.testsDone === 0 ? (
          <p className={styles.note}>Your results show here once your teacher releases them.</p>
        ) : (
          <>
            <dl className={styles.stats}>
              <Stat label="Done" value={countOf(summary.testsDone, 'test')} />
              <Stat label="Average" value={`${summary.averagePercent ?? 0}%`} />
              {summary.bestSubject && (
                <Stat label="Best subject" value={summary.bestSubject.name} />
              )}
              {summary.trend && <Stat label="Trend" value={TREND_LABELS[summary.trend]} />}
            </dl>
            <ScoreLineChart points={scoreTimeline(results)} label="Scores over time" />
          </>
        )}
      </Panel>
      {subjectRows.length > 0 && (
        <Panel title="Subjects">
          <PercentBars
            items={subjectRows.map((subject) => ({
              key: subject.subjectId,
              label: subjectPath ? (
                <Link to={subjectPath(subject.subjectId)}>{subject.name}</Link>
              ) : (
                subject.name
              ),
              percent: subject.averagePercent,
              detail:
                subject.testsDone === 0
                  ? 'No results yet'
                  : `${countOf(subject.testsDone, 'result')}`,
            }))}
          />
        </Panel>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
