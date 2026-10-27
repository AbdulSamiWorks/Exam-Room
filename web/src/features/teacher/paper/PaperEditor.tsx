import type { NumberedQuestion } from '@exam-room/shared';
import { checksAutomatically, markableUnitsOf, questionsOf } from '@exam-room/shared/paper-rules';
import { useState, type ChangeEvent } from 'react';
import { Button } from '../../../components/Button';
import { TextAreaField } from '../../../components/TextAreaField';
import { describeMarks } from '../../../lib/describe-marks';
import { shrinkImage } from '../../../lib/shrink-image';
import { countOf } from '../../../lib/text';
import { PaperView } from '../../paper/PaperView';
import { PreviewBlank, PreviewUnitAnswer } from './PreviewAnswer';
import { describePaperProblem, type ImportedPaper } from './imported-paper';
import { SAMPLE_PAPERS } from './sample-paper';
import type { PaperDraft } from './use-paper-draft';
import { useObjectUrls } from './use-object-urls';
import styles from './PaperEditor.module.css';

const PAPER_PICTURE = { maxSidePx: 1000, type: 'image/webp', quality: 0.8 } as const;

const FORMAT_HINT =
  'Paste the paper as text or JSON. Start each question with 1. and each option with a), b), …';

export function PaperEditor({ draft, errorMessage }: { draft: PaperDraft; errorMessage?: string }) {
  const pictureUrls = useObjectUrls(draft.pictures);
  const { imported } = draft;

  return (
    <div className={styles.editor}>
      <TextAreaField
        label="Questions"
        hint={FORMAT_HINT}
        value={draft.text}
        rows={14}
        dir="auto"
        spellCheck={false}
        className={styles.textArea}
        onChange={(event) => draft.changeText(event.target.value)}
        errorMessage={errorMessage}
      />
      <div className={styles.actions}>
        {!draft.text.trim() &&
          SAMPLE_PAPERS.map((sample) => (
            <Button
              key={sample.name}
              variant="secondary"
              size="small"
              onClick={() => draft.changeText(sample.text)}
            >
              Sample: {sample.name}
            </Button>
          ))}
      </div>
      <FormatHelp />
      {imported && <ImportReport imported={imported} />}
      {imported && imported.problems.length === 0 && (
        <details className={styles.preview} open>
          <summary>Preview, as students will see it</summary>
          <PaperView
            paper={imported.paper}
            correctOptions={correctOptionsOf(imported)}
            renderUnitAnswer={(unit) => (
              <PreviewUnitAnswer unit={unit} answer={imported.answerKey[unit.id]} />
            )}
            renderBlank={(unit, blankIndex) => (
              <PreviewBlank accepted={imported.answerKey[unit.id]?.blanks?.[blankIndex]} />
            )}
            renderQuestionExtra={(question) => (
              <PictureControl
                question={question}
                pictureUrl={pictureUrls.get(question.id)}
                onChange={(picture) => draft.setPicture(question.id, picture)}
              />
            )}
          />
        </details>
      )}
    </div>
  );
}

function ImportReport({ imported }: { imported: ImportedPaper }) {
  const questions = questionsOf(imported.paper);
  const mcqs = questions.filter((question) => question.kind === 'mcq');
  const answeredMcqs = mcqs.filter(
    (question) => imported.answerKey[question.id]?.option !== undefined,
  );
  const totalMarks = questions.reduce((total, question) => total + question.marks, 0);
  const typedUnits = markableUnitsOf(imported.paper).filter(
    (unit) => unit.kind === 'short' || unit.kind === 'blanks',
  );
  const checkedUnits = typedUnits.filter((unit) =>
    checksAutomatically(unit, imported.answerKey[unit.id]),
  );

  if (imported.problems.length > 0) {
    return (
      <div className={styles.problems} role="alert">
        <p className={styles.reportTitle}>Fix these first:</p>
        <ul>
          {imported.problems.map((problem) => (
            <li key={`${problem.lineNumber}-${problem.message}`}>
              {describePaperProblem(problem)}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.report}>
      <p className={styles.reportTitle}>
        {countOf(questions.length, 'question')} · {describeMarks(totalMarks)}
        {mcqs.length > 0 && ` · answers for ${answeredMcqs.length} of ${mcqs.length} MCQs`}
        {typedUnits.length > 0 &&
          ` · the app checks ${checkedUnits.length} of ${typedUnits.length} typed answers`}
      </p>
      {imported.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {imported.warnings.map((warning) => (
            <li key={`${warning.lineNumber}-${warning.message}`}>
              {describePaperProblem(warning)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type PictureControlProps = {
  question: NumberedQuestion;
  pictureUrl: string | undefined;
  onChange: (picture: Blob | undefined) => void;
};

function PictureControl({ question, pictureUrl, onChange }: PictureControlProps) {
  const [errorMessage, setErrorMessage] = useState<string>();

  async function choosePicture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErrorMessage(undefined);
    try {
      onChange(await shrinkImage(file, PAPER_PICTURE));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The picture could not be used.');
    }
  }

  if (pictureUrl) {
    return (
      <div className={styles.picture}>
        <img src={pictureUrl} alt={`Picture for question ${question.number}`} />
        <Button variant="secondary" size="small" onClick={() => onChange(undefined)}>
          Remove picture
        </Button>
      </div>
    );
  }

  return (
    <label className={styles.addPicture}>
      <input
        type="file"
        accept="image/*"
        className={styles.fileInput}
        onChange={(event) => void choosePicture(event)}
      />
      + Add a picture to question {question.number}
      {errorMessage && <span className={styles.pictureError}>{errorMessage}</span>}
    </label>
  );
}

function FormatHelp() {
  return (
    <details className={styles.help}>
      <summary>How to write the paper</summary>
      <ul>
        <li>
          <code># Section A</code> starts a section. Lines under it are its instructions.
        </li>
        <li>
          <code>1. Question text [2 marks]</code> starts a question. Without marks it counts 1 mark.
        </li>
        <li>
          <code>a) option</code>, <code>b) option</code> … make it a multiple choice question.
        </li>
        <li>
          <code>Answer: b</code> gives the correct option. For a written question,{' '}
          <code>Answer: …</code> is the model answer.
        </li>
        <li>
          Parts with their own marks, like <code>a) Define speed. [2]</code>, stay one written
          question.
        </li>
        <li>
          A part followed by its own <code>Answer: …</code> line gets its own answer box, and the
          app checks the sentence word by word. Write several right answers like{' '}
          <code>Answer: He doesn't play. | He does not play.</code>
        </li>
        <li>
          <code>Model answer: …</code> under a part gives it a box that you or the AI mark.
        </li>
        <li>
          Blanks are written as <code>_____</code>. Give their answers in order:{' '}
          <code>Answer: had run; is knocking</code>.
        </li>
        <li>Students never see the answers before you release the results.</li>
      </ul>
    </details>
  );
}

function correctOptionsOf(imported: ImportedPaper): Record<string, number | undefined> {
  return Object.fromEntries(
    Object.entries(imported.answerKey).map(([questionId, answer]) => [questionId, answer.option]),
  );
}
