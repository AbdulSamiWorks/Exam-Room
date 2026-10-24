import type { NumberedQuestion, Paper } from '@exam-room/shared';
import { numberQuestions, optionLetter } from '@exam-room/shared/paper-rules';
import type { ReactNode } from 'react';
import { classNames } from '../../lib/class-names';
import { describeMarks } from '../../lib/describe-marks';
import { InlineText, RichText } from './RichText';
import styles from './PaperView.module.css';

export type PaperViewProps = {
  paper: Paper;
  renderPicture?: (imageNumber: number, question: NumberedQuestion) => ReactNode;
  correctOptions?: Readonly<Record<string, number | undefined>>;
  chosenOptions?: Readonly<Record<string, number | undefined>>;
  onChooseOption?: (questionId: string, option: number) => void;
  renderQuestionExtra?: (question: NumberedQuestion) => ReactNode;
};

type OptionState = 'chosenOption' | 'rightChoice' | 'wrongChoice' | 'correctOption';

const OPTION_STATE_LABELS: Record<OptionState, string> = {
  chosenOption: '',
  rightChoice: '✓ Your answer',
  wrongChoice: '✗ Your answer',
  correctOption: '✓ Correct answer',
};

function optionState(
  isChosen: boolean,
  correctOption: number | undefined,
  isCorrect: boolean,
): OptionState | undefined {
  if (correctOption === undefined) return isChosen ? 'chosenOption' : undefined;
  if (isChosen) return isCorrect ? 'rightChoice' : 'wrongChoice';
  return isCorrect ? 'correctOption' : undefined;
}

export function PaperView({
  paper,
  renderPicture,
  correctOptions,
  chosenOptions,
  onChooseOption,
  renderQuestionExtra,
}: PaperViewProps) {
  const numberedQuestions = numberQuestions(paper);

  return (
    <article className={styles.paper}>
      {paper.instructions && (
        <div className={styles.paperInstructions} dir="auto">
          <RichText text={paper.instructions} />
        </div>
      )}
      {paper.sections.map((section, sectionIndex) => (
        <section key={sectionIndex} className={styles.section}>
          {section.title && (
            <h2 className={styles.sectionTitle} dir="auto">
              {section.title}
            </h2>
          )}
          {section.instructions && (
            <div className={styles.sectionInstructions} dir="auto">
              <RichText text={section.instructions} />
            </div>
          )}
          <ol className={styles.questions}>
            {numberedQuestions
              .filter((question) => question.sectionIndex === sectionIndex)
              .map((question) => (
                <QuestionView
                  key={question.id}
                  question={question}
                  picture={
                    question.imageNumber === null
                      ? undefined
                      : renderPicture?.(question.imageNumber, question)
                  }
                  correctOption={correctOptions?.[question.id]}
                  chosenOption={chosenOptions?.[question.id]}
                  onChooseOption={onChooseOption}
                  extra={renderQuestionExtra?.(question)}
                />
              ))}
          </ol>
        </section>
      ))}
    </article>
  );
}

type QuestionViewProps = {
  question: NumberedQuestion;
  picture: ReactNode;
  correctOption: number | undefined;
  chosenOption: number | undefined;
  onChooseOption: PaperViewProps['onChooseOption'];
  extra: ReactNode;
};

function QuestionView({
  question,
  picture,
  correctOption,
  chosenOption,
  onChooseOption,
  extra,
}: QuestionViewProps) {
  const textId = `question-${question.id}-text`;

  return (
    <li className={styles.question}>
      <div className={styles.questionHeader}>
        <span className={styles.questionNumber}>{question.number}.</span>
        <div id={textId} className={styles.questionText} dir="auto">
          <RichText text={question.text} />
        </div>
        <span className={styles.marks}>{describeMarks(question.marks)}</span>
      </div>
      {picture}
      {question.options.length > 0 && (
        <div
          className={styles.options}
          role="radiogroup"
          aria-labelledby={textId}
          aria-readonly={onChooseOption ? undefined : true}
        >
          {question.options.map((option, optionIndex) => {
            const state = optionState(
              chosenOption === optionIndex,
              correctOption,
              correctOption === optionIndex,
            );
            return (
              <button
                key={optionIndex}
                type="button"
                role="radio"
                aria-checked={chosenOption === optionIndex}
                disabled={!onChooseOption}
                className={classNames(styles.option, state && styles[state])}
                onClick={() => onChooseOption?.(question.id, optionIndex)}
              >
                <span className={styles.optionLetter}>{optionLetter(optionIndex)}</span>
                <span className={styles.optionText} dir="auto">
                  <InlineText text={option} />
                </span>
                {state && OPTION_STATE_LABELS[state] && (
                  <span className={styles.optionMark}>{OPTION_STATE_LABELS[state]}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {extra}
    </li>
  );
}
