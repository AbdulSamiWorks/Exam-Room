import type { MarkableUnit, StudentResultResponse, UnitResult } from '@exam-room/shared';
import { useParams } from 'react-router';
import { FormError } from '../../components/FormError';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page } from '../../components/Page';
import { Panel } from '../../components/Panel';
import { ThemeToggle } from '../../components/ThemeToggle';
import { describeScore } from '../../lib/describe-marks';
import { joinWithAnd } from '../../lib/text';
import { PaperView } from '../paper/PaperView';
import { AnswerCounts } from './AnswerCounts';
import { automaticSummary, checksOnlyMultipleChoice } from './result-summary';
import { ResultBlank, UnitResultView } from './UnitResultView';
import { useStudentResult } from './use-student-result';
import styles from './StudentResultPage.module.css';

const BACK_HOME = { to: '/', label: 'My tests' };

export function StudentResultPage() {
  const testCode = (useParams().testCode ?? '').toUpperCase();
  const resultQuery = useStudentResult(testCode);

  if (resultQuery.isPending) return <LoadingScreen />;
  if (resultQuery.isError) {
    return (
      <Page title="Result" backLink={BACK_HOME} actions={<ThemeToggle />}>
        <FormError>{resultQuery.error.message}</FormError>
      </Page>
    );
  }

  const result = resultQuery.data;
  return (
    <Page
      title={result.testTitle}
      subtitle={result.subjectName}
      backLink={BACK_HOME}
      actions={<ThemeToggle />}
    >
      <div className={styles.sections}>
        <Panel>
          {!result.isFinal && (
            <p className={styles.note}>
              {checksOnlyMultipleChoice(result)
                ? 'Multiple choice result'
                : 'Answers checked by the app'}
            </p>
          )}
          <p className={styles.score}>{describeScore(result.totalMarks, result.maxMarks)}</p>
          <AnswerCounts summary={automaticSummary(result.units)} />
          {!result.isFinal && (
            <p className={styles.note}>
              Your teacher marks the written answers. The full result comes when your teacher
              releases it.
            </p>
          )}
          {result.topScorers && result.topScorers.length > 0 && (
            <p className={styles.note}>
              {result.topScorers.length === 1 ? 'Top scorer' : 'Top scorers'}:{' '}
              {joinWithAnd(result.topScorers)}
            </p>
          )}
          {result.comment && (
            <p className={styles.comment} dir="auto">
              {result.comment}
            </p>
          )}
        </Panel>
        {result.paper && <ResultPaper result={result} />}
      </div>
    </Page>
  );
}

function ResultPaper({ result }: { result: StudentResultResponse }) {
  const unitsById = new Map(result.units.map((unit) => [unit.unitId, unit]));
  const optionsBy = (pick: (unit: UnitResult) => number | null) =>
    Object.fromEntries(result.units.map((unit) => [unit.unitId, pick(unit) ?? undefined]));

  function renderUnitAnswer(unit: MarkableUnit) {
    const unitResult = unitsById.get(unit.id);
    if (!unitResult) return null;
    return <UnitResultView unit={unit} result={unitResult} isFinal={result.isFinal} />;
  }

  return (
    <PaperView
      paper={result.paper ?? { instructions: '', sections: [] }}
      chosenOptions={optionsBy((unit) => unit.chosenOption)}
      correctOptions={optionsBy((unit) => unit.correctOption)}
      renderUnitAnswer={renderUnitAnswer}
      renderBlank={(unit, blankIndex) => {
        const unitResult = unitsById.get(unit.id);
        return unitResult ? <ResultBlank result={unitResult} blankIndex={blankIndex} /> : null;
      }}
    />
  );
}
