import type { MarkableUnit, NumberedQuestion, Paper } from '@exam-room/shared';
import { numberQuestions, optionLetter, unitsOfQuestion } from '@exam-room/shared/paper-rules';
import type { ReactNode } from 'react';
import { classNames } from '../../lib/class-names';
import { describeMarks } from '../../lib/describe-marks';
import { InlineText, RichText, type RenderBlank } from './RichText';
import styles from './PaperView.module.css';

export type PaperViewProps = {
  paper: Paper;
  renderPicture?: (imageNumber: number, question: NumberedQuestion) => ReactNode;
  correctOptions?: Readonly<Record<string, number | undefined>>;
  chosenOptions?: Readonly<Record<string, number | undefined>>;
  onChooseOption?: (unitId: string, option: number) => void;
  renderUnitAnswer?: (unit: MarkableUnit) => ReactNode;
  renderBlank?: (unit: MarkableUnit, blankIndex: number) => ReactNode;
  renderQuestionExtra?: (question: NumberedQuestion) => ReactNode;
};

type AnsweringProps = Omit<PaperViewProps, 'paper' | 'renderPicture' | 'renderQuestionExtra'>;

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
  renderQuestionExtra,
  ...answering
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
                  extra={renderQuestionExtra?.(question)}
                  {...answering}
                />
              ))}
          </ol>
        </section>
      ))}
    </article>
  );
}

type QuestionViewProps = AnsweringProps & {
  question: NumberedQuestion;
  picture: ReactNode;
  extra: ReactNode;
};

function QuestionView({ question, picture, extra, ...answering }: QuestionViewProps) {
  const units = unitsOfQuestion(question);
  const [onlyUnit] = units;
  const hasParts = question.kind === 'parts';
  const showsPartMarks = new Set(units.map((unit) => unit.marks)).size > 1;

  return (
    <li className={styles.question}>
      <div className={styles.questionHeader}>
        <span className={styles.questionNumber}>{question.number}.</span>
        <div id={textIdOf(question.id)} className={styles.questionText} dir="auto">
          <RichText
            text={question.text}
            renderBlank={hasParts || !onlyUnit ? undefined : blankRenderer(onlyUnit, answering)}
          />
        </div>
        <span className={styles.marks}>{describeMarks(question.marks)}</span>
      </div>
      {picture}
      {hasParts ? (
        <ol className={styles.parts}>
          {units.map((unit) => (
            <li key={unit.id} className={styles.part}>
              <div className={styles.partHeader}>
                <span className={styles.partLetter}>{unit.partLetter})</span>
                <div id={textIdOf(unit.id)} className={styles.partText} dir="auto">
                  <RichText text={unit.text} renderBlank={blankRenderer(unit, answering)} />
                </div>
                {showsPartMarks && (
                  <span className={styles.partMarks}>{describeMarks(unit.marks)}</span>
                )}
              </div>
              <UnitAnswerArea unit={unit} {...answering} />
            </li>
          ))}
        </ol>
      ) : (
        onlyUnit && <UnitAnswerArea unit={onlyUnit} {...answering} />
      )}
      {extra}
    </li>
  );
}

function textIdOf(unitId: string): string {
  return `question-${unitId}-text`;
}

function blankRenderer(unit: MarkableUnit, answering: AnsweringProps): RenderBlank | undefined {
  const { renderBlank } = answering;
  if (unit.kind !== 'blanks' || !renderBlank) return undefined;
  return (blankIndex) => renderBlank(unit, blankIndex);
}

type UnitAnswerAreaProps = AnsweringProps & {
  unit: MarkableUnit;
};

function UnitAnswerArea({
  unit,
  correctOptions,
  chosenOptions,
  onChooseOption,
  renderUnitAnswer,
}: UnitAnswerAreaProps) {
  return (
    <>
      {unit.kind === 'mcq' && (
        <OptionList
          unit={unit}
          correctOption={correctOptions?.[unit.id]}
          chosenOption={chosenOptions?.[unit.id]}
          onChooseOption={onChooseOption}
        />
      )}
      {renderUnitAnswer?.(unit)}
    </>
  );
}

type OptionListProps = {
  unit: MarkableUnit;
  correctOption: number | undefined;
  chosenOption: number | undefined;
  onChooseOption: PaperViewProps['onChooseOption'];
};

function OptionList({ unit, correctOption, chosenOption, onChooseOption }: OptionListProps) {
  return (
    <div
      className={styles.options}
      role="radiogroup"
      aria-labelledby={textIdOf(unit.id)}
      aria-readonly={onChooseOption ? undefined : true}
    >
      {unit.options.map((option, optionIndex) => {
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
            onClick={() => onChooseOption?.(unit.id, optionIndex)}
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
  );
}
