import type { MarkableUnit, StudentAttempt } from '@exam-room/shared';
import { blankSlotId } from '@exam-room/shared/paper-rules';
import { useState } from 'react';
import { TabButtons } from '../../../components/TabButtons';
import { takesTypedWrittenAnswers } from '../answers/answer-rules';
import { recordAnswer, type OutboxSnapshot } from '../answers/outbox-store';
import { chosenOptionsOf } from '../answers/outbox-state';
import { BlankInput } from '../answers/BlankInput';
import { ShortAnswerBox } from '../answers/ShortAnswerBox';
import { WrittenAnswerBox } from '../answers/WrittenAnswerBox';
import { PaperViewer } from './PaperViewer';
import { TypedPaperViewer } from './TypedPaperViewer';
import styles from './ExamScreen.module.css';

const TEXT_SEND_DELAY_MS = 1500;

type ExamView = 'paper' | 'sheet';

const VIEW_TABS: Array<{ value: ExamView; label: string }> = [
  { value: 'paper', label: 'Paper' },
  { value: 'sheet', label: 'Answer sheet' },
];

type ExamBodyProps = {
  testCode: string;
  attemptToken: string;
  attempt: StudentAttempt;
  outbox: OutboxSnapshot | undefined;
};

export function ExamBody({ testCode, attemptToken, attempt, outbox }: ExamBodyProps) {
  const [view, setView] = useState<ExamView>('paper');
  const { test } = attempt;
  const answers = outbox?.outbox.answers ?? {};
  const typesWrittenAnswers = takesTypedWrittenAnswers(test.writtenAnswers);

  function chooseOption(questionId: string, option: number) {
    const isSameChoice = answers[questionId]?.choice === option;
    recordAnswer(testCode, questionId, { choice: isSameChoice ? null : option, text: null });
  }

  function writeText(slotId: string, text: string) {
    recordAnswer(testCode, slotId, { choice: null, text }, TEXT_SEND_DELAY_MS);
  }

  function renderUnitAnswer(unit: MarkableUnit) {
    if (unit.kind === 'short') {
      return (
        <ShortAnswerBox
          questionLabel={unit.label}
          value={answers[unit.id]?.text ?? ''}
          onChange={(text) => writeText(unit.id, text)}
        />
      );
    }
    if (unit.kind !== 'written') return null;
    if (!typesWrittenAnswers) {
      return <p className={styles.writtenNote}>Write this answer on your own paper.</p>;
    }
    return (
      <WrittenAnswerBox
        questionLabel={unit.label}
        value={answers[unit.id]?.text ?? ''}
        onChange={(text) => writeText(unit.id, text)}
      />
    );
  }

  function renderBlank(unit: MarkableUnit, blankIndex: number) {
    const slotId = blankSlotId(unit.id, blankIndex);
    return (
      <BlankInput
        label={`Blank ${blankIndex + 1} of question ${unit.label}`}
        value={answers[slotId]?.text ?? ''}
        onChange={(text) => writeText(slotId, text)}
      />
    );
  }

  const questionView = (
    <TypedPaperViewer
      testCode={testCode}
      attemptToken={attemptToken}
      chosenOptions={outbox ? chosenOptionsOf(outbox.outbox) : undefined}
      onChooseOption={outbox ? chooseOption : undefined}
      renderUnitAnswer={renderUnitAnswer}
      renderBlank={renderBlank}
    />
  );

  if (test.paperKind === 'typed') return questionView;

  const pages = (
    <PaperViewer testCode={testCode} attemptToken={attemptToken} pageSizes={attempt.pageSizes} />
  );
  if (test.questionCount === 0) return pages;

  return (
    <>
      <TabButtons
        label="Paper or answer sheet"
        tabs={VIEW_TABS}
        selectedValue={view}
        onSelect={setView}
        className={styles.viewTabs}
      />
      <div className={styles.viewArea} hidden={view !== 'paper'}>
        {pages}
      </div>
      {view === 'sheet' && questionView}
    </>
  );
}
