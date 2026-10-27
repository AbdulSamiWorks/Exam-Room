import type { Paper, TestSummary, TeacherPaperResponse } from '@exam-room/shared';
import { questionsOf } from '@exam-room/shared/paper-rules';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Page } from '../../../components/Page';
import { Panel } from '../../../components/Panel';
import { useTest } from '../tests/use-tests';
import { AnswerKeyEditor } from './AnswerKeyEditor';
import { AnswerSheetForm } from './AnswerSheetForm';
import { PaperEditor } from './PaperEditor';
import { editableTextOf } from './import-paper';
import { usePaperDraft } from './use-paper-draft';
import {
  fetchTeacherPaperImage,
  paperQueryKeys,
  useReplaceTestPaper,
  useSaveAnswerKey,
  useTeacherPaper,
} from './use-paper';
import styles from './PaperPage.module.css';

export function PaperPage() {
  const testId = Number(useParams().testId);
  const testQuery = useTest(testId);
  const paperQuery = useTeacherPaper(testId);
  const backLink = { to: `/teacher/tests/${testId}`, label: 'Back to the test' };

  if (testQuery.isPending || paperQuery.isPending) return <LoadingScreen />;
  const error = testQuery.error ?? paperQuery.error;
  if (error || !testQuery.data || !paperQuery.data) {
    return (
      <Page title="Questions and answers" backLink={backLink}>
        <FormError>{error?.message ?? 'Something went wrong.'}</FormError>
      </Page>
    );
  }

  const test = testQuery.data;
  const title = test.paperKind === 'typed' ? 'Questions and answers' : 'Answer sheet';
  return (
    <Page title={title} subtitle={test.title} backLink={backLink}>
      <div className={styles.sections}>
        {test.paperKind === 'typed' ? (
          <TypedPaperSections test={test} stored={paperQuery.data} />
        ) : (
          <AnswerSheetSections test={test} stored={paperQuery.data} />
        )}
      </div>
    </Page>
  );
}

type PaperSectionsProps = {
  test: TestSummary;
  stored: TeacherPaperResponse;
};

function AnswerKeyPanel({ test, paper, stored }: PaperSectionsProps & { paper: Paper }) {
  const saveAnswerKey = useSaveAnswerKey(test.id);
  return (
    <Panel title="Correct answers">
      <p className={styles.note}>
        You can change the answers at any time, also after the test. Students never see them before
        you release the results.
      </p>
      <AnswerKeyEditor
        key={JSON.stringify(stored.answerKey)}
        paper={paper}
        answerKey={stored.answerKey}
        isSaving={saveAnswerKey.isPending}
        errorMessage={saveAnswerKey.error?.message}
        onSave={(answerKey) => saveAnswerKey.mutate(answerKey)}
      />
      {saveAnswerKey.isSuccess && <p className={styles.saved}>Answers saved.</p>}
    </Panel>
  );
}

function TypedPaperSections({ test, stored }: PaperSectionsProps) {
  const paper = stored.paper;
  if (!paper) return <FormError>This test has no questions.</FormError>;

  return (
    <>
      <AnswerKeyPanel test={test} paper={paper} stored={stored} />
      {test.studentCount > 0 ? (
        <p className={styles.note}>
          Students have already started, so the questions cannot change any more.
        </p>
      ) : (
        <Panel title="Edit the questions">
          <EditableTypedPaper test={test} stored={stored} paper={paper} />
        </Panel>
      )}
    </>
  );
}

function EditableTypedPaper({ test, stored, paper }: PaperSectionsProps & { paper: Paper }) {
  const picturesQuery = useQuery({
    queryKey: [...paperQueryKeys.paper(test.id), 'pictures', stored.imageCount],
    queryFn: () => loadPicturesByQuestion(test.id, paper),
    staleTime: Infinity,
  });

  if (picturesQuery.isPending) return <p className={styles.note}>Loading pictures…</p>;
  if (picturesQuery.isError) return <FormError>{picturesQuery.error.message}</FormError>;

  return (
    <TypedPaperForm
      key={JSON.stringify(paper)}
      testId={test.id}
      initialText={editableTextOf(paper, stored.answerKey)}
      initialPictures={picturesQuery.data}
    />
  );
}

type TypedPaperFormProps = {
  testId: number;
  initialText: string;
  initialPictures: ReadonlyMap<string, Blob>;
};

function TypedPaperForm({ testId, initialText, initialPictures }: TypedPaperFormProps) {
  const draft = usePaperDraft(initialText, initialPictures);
  const replacePaper = useReplaceTestPaper(testId);

  function save() {
    const upload = draft.toUpload();
    if (upload) replacePaper.mutate(upload);
  }

  return (
    <div className={styles.sections}>
      <PaperEditor draft={draft} />
      {replacePaper.error && <FormError>{replacePaper.error.message}</FormError>}
      {replacePaper.isSuccess && <p className={styles.saved}>Questions saved.</p>}
      <Button onClick={save} disabled={!draft.isReady || replacePaper.isPending}>
        {replacePaper.isPending ? 'Saving…' : 'Save the questions'}
      </Button>
    </div>
  );
}

function AnswerSheetSections({ test, stored }: PaperSectionsProps) {
  const replacePaper = useReplaceTestPaper(test.id);
  const sheet = stored.paper;

  return (
    <>
      <Panel title={sheet ? 'Answer sheet' : 'Add an answer sheet'}>
        <p className={styles.note}>
          With an answer sheet, students tap their multiple choice answers under the PDF and the app
          marks them for you.
          {sheet && ` Now: ${questionsOf(sheet).length} questions.`}
        </p>
        {test.studentCount > 0 ? (
          <p className={styles.note}>Students have already started, so the sheet stays as it is.</p>
        ) : (
          <AnswerSheetForm
            currentSheet={sheet}
            currentAnswerKey={stored.answerKey}
            isSaving={replacePaper.isPending}
            errorMessage={replacePaper.error?.message}
            onSave={(upload) => replacePaper.mutate(upload)}
          />
        )}
      </Panel>
      {sheet && <AnswerKeyPanel test={test} paper={sheet} stored={stored} />}
    </>
  );
}

async function loadPicturesByQuestion(testId: number, paper: Paper): Promise<Map<string, Blob>> {
  const pictures = new Map<string, Blob>();
  for (const question of questionsOf(paper)) {
    if (question.imageNumber !== null) {
      pictures.set(question.id, await fetchTeacherPaperImage(testId, question.imageNumber));
    }
  }
  return pictures;
}
