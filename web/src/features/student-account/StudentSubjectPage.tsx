import { useParams } from 'react-router';
import { PercentBars } from '../../components/charts/PercentBars';
import { ScoreLineChart } from '../../components/charts/ScoreLineChart';
import { FormError } from '../../components/FormError';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page } from '../../components/Page';
import { Panel } from '../../components/Panel';
import { ThemeToggle } from '../../components/ThemeToggle';
import { countOf } from '../../lib/text';
import { averagePercentOf, chapterSummaries, scoreTimeline } from '../progress/progress-stats';
import { StudentTestList } from './StudentTestLink';
import { useStudentHome } from './use-student-account';
import { useStudentProgress } from './use-student-progress';
import styles from './StudentHomePage.module.css';

const BACK_HOME = { to: '/', label: 'My tests' };

export function StudentSubjectPage() {
  const subjectId = Number(useParams().subjectId);
  const progress = useStudentProgress();
  const home = useStudentHome();

  if (progress.isPending || home.isPending) return <LoadingScreen />;
  const error = progress.error ?? home.error;
  if (error || !progress.data || !home.data) {
    return (
      <Page title="Subject" backLink={BACK_HOME} actions={<ThemeToggle />}>
        <FormError>{error?.message ?? 'Something went wrong.'}</FormError>
      </Page>
    );
  }

  const subject = progress.data.subjects.find((candidate) => candidate.id === subjectId);
  const results = progress.data.results.filter((result) => result.subjectId === subjectId);
  const tests = home.data.tests.filter((test) => test.subjectId === subjectId);
  const average = averagePercentOf(results);

  return (
    <Page
      title={subject?.name ?? results[0]?.subjectName ?? 'Subject'}
      subtitle={
        average === null
          ? 'No results yet'
          : `Average ${average}% · ${countOf(results.length, 'result')}`
      }
      backLink={BACK_HOME}
      actions={<ThemeToggle />}
    >
      <div className={styles.sections}>
        {results.length > 1 && (
          <Panel title="Over time">
            <ScoreLineChart points={scoreTimeline(results)} label="Scores over time" />
          </Panel>
        )}
        {subject && subject.chapters.length > 0 && (
          <Panel title="Chapters">
            <PercentBars
              items={chapterSummaries(results, subject.chapters).map((chapter) => ({
                key: chapter.chapterId,
                label: chapter.name,
                percent: chapter.averagePercent,
                detail:
                  chapter.testsDone === 0 ? 'No results yet' : countOf(chapter.testsDone, 'result'),
              }))}
            />
          </Panel>
        )}
        <Panel title="Tests, quizzes and assignments">
          {tests.length === 0 ? (
            <p className={styles.emptyMessage}>Nothing here yet.</p>
          ) : (
            <StudentTestList tests={tests} />
          )}
        </Panel>
      </div>
    </Page>
  );
}
