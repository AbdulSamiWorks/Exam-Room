import type { StudentResultResponse } from '@exam-room/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { getJson } from '../../api/http-client';
import { FormError } from '../../components/FormError';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page } from '../../components/Page';
import { Panel } from '../../components/Panel';
import { ThemeToggle } from '../../components/ThemeToggle';
import { describeMarks, describeScore, formatMarks } from '../../lib/describe-marks';
import { joinWithAnd } from '../../lib/text';
import { PaperView } from '../paper/PaperView';
import styles from './StudentResultPage.module.css';

const BACK_HOME = { to: '/', label: 'My tests' };

export function StudentResultPage() {
  const testCode = (useParams().testCode ?? '').toUpperCase();
  const resultQuery = useQuery({
    queryKey: ['student-result', testCode],
    queryFn: () => getJson<StudentResultResponse>(`/student/results/${testCode}`),
    retry: false,
  });

  if (resultQuery.isPending) return <LoadingScreen />;
  if (resultQuery.isError) {
    return (
      <Page title="Result" backLink={BACK_HOME} actions={<ThemeToggle />}>
        <FormError>{resultQuery.error.message}</FormError>
      </Page>
    );
  }

  const result = resultQuery.data;
  const questionsById = new Map(
    result.questions.map((question) => [question.questionId, question]),
  );
  const chosenOptions = Object.fromEntries(
    result.questions.map((question) => [question.questionId, question.chosenOption ?? undefined]),
  );
  const correctOptions = Object.fromEntries(
    result.questions.map((question) => [question.questionId, question.correctOption ?? undefined]),
  );

  return (
    <Page
      title={result.testTitle}
      subtitle={result.subjectName}
      backLink={BACK_HOME}
      actions={<ThemeToggle />}
    >
      <div className={styles.sections}>
        <Panel>
          <p className={styles.score}>{describeScore(result.totalMarks, result.maxMarks)}</p>
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
        {result.paper && (
          <PaperView
            paper={result.paper}
            chosenOptions={chosenOptions}
            correctOptions={correctOptions}
            renderQuestionExtra={(question) => {
              const questionResult = questionsById.get(question.id);
              if (!questionResult) return null;
              return (
                <div className={styles.questionResult}>
                  {questionResult.typedAnswer && (
                    <p className={styles.typedAnswer} dir="auto">
                      {questionResult.typedAnswer}
                    </p>
                  )}
                  <p className={styles.marks}>
                    {questionResult.marks === null
                      ? 'Not marked'
                      : `${formatMarks(questionResult.marks)} of ${describeMarks(question.marks)}`}
                  </p>
                  {questionResult.comment && (
                    <p className={styles.comment} dir="auto">
                      {questionResult.comment}
                    </p>
                  )}
                </div>
              );
            }}
          />
        )}
      </div>
    </Page>
  );
}
