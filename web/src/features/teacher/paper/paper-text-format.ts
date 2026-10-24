import type { AnswerKey, Paper, PaperQuestion, PaperSection } from '@exam-room/shared';
import { optionIndexOf, optionLetter, paperLimits } from '@exam-room/shared/paper-rules';
import {
  questionIdFor,
  schemaProblems,
  type ImportedPaper,
  type PaperProblem,
} from './imported-paper';

const SECTION_LINE = /^#+\s*(.*)$/;
const QUESTION_LINE = /^(?:Q(?:uestion)?\s*)?\d{1,3}\s*[.):]\s*(.+)$/i;
const OPTION_LINE = /^\(?([a-f])[.)]\s+(.+)$/i;
const ANSWER_LINE = /^(?:answer|ans|correct answer)\s*[:-]\s*(.*)$/i;
const MARKS_AT_END = /\s*[[(]\s*(\d+(?:\.5)?)\s*(?:marks?|m)?\s*[\])]\s*$/i;
const DEFAULT_MARKS = 1;

type DraftQuestion = {
  lineNumber: number;
  textLines: string[];
  marks: number | undefined;
  options: string[];
  answerLetter: string | undefined;
  answerLineNumber: number;
  modelAnswerLines: string[];
  subPartCount: number;
  subPartMarks: number;
};

type DraftSection = {
  title: string;
  instructionLines: string[];
  questions: DraftQuestion[];
};

export function parsePaperText(text: string): ImportedPaper {
  const problems: PaperProblem[] = [];
  const paperInstructionLines: string[] = [];
  const sections: DraftSection[] = [];
  let currentQuestion: DraftQuestion | undefined;

  function currentSection(): DraftSection {
    const lastSection = sections.at(-1);
    if (lastSection) return lastSection;
    const firstSection: DraftSection = { title: '', instructionLines: [], questions: [] };
    sections.push(firstSection);
    return firstSection;
  }

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line) return;

    const sectionMatch = SECTION_LINE.exec(line);
    if (sectionMatch) {
      sections.push({ title: sectionMatch[1] ?? '', instructionLines: [], questions: [] });
      currentQuestion = undefined;
      return;
    }

    const questionMatch = QUESTION_LINE.exec(line);
    if (questionMatch) {
      currentQuestion = newQuestion(questionMatch[1] ?? '', lineNumber);
      currentSection().questions.push(currentQuestion);
      return;
    }

    const answerMatch = ANSWER_LINE.exec(line);
    if (answerMatch) {
      if (!currentQuestion) {
        problems.push({ lineNumber, message: 'this answer comes before any question.' });
        return;
      }
      if (currentQuestion.answerLetter !== undefined || currentQuestion.modelAnswerLines.length) {
        problems.push({ lineNumber, message: 'this question already has an answer.' });
        return;
      }
      setAnswer(currentQuestion, answerMatch[1] ?? '', lineNumber);
      return;
    }

    const optionMatch = OPTION_LINE.exec(line);
    if (
      optionMatch &&
      currentQuestion &&
      isNextSubPart(line, optionMatch[1] ?? '', currentQuestion)
    ) {
      addSubPart(currentQuestion, line);
      return;
    }
    if (optionMatch && currentQuestion && isNextOption(optionMatch[1] ?? '', currentQuestion)) {
      currentQuestion.options.push(optionMatch[2] ?? '');
      return;
    }
    if (optionMatch && !currentQuestion) {
      problems.push({ lineNumber, message: 'this option comes before any question.' });
      return;
    }

    if (currentQuestion) {
      continueQuestion(currentQuestion, line);
    } else if (sections.length > 0) {
      currentSection().instructionLines.push(line);
    } else {
      paperInstructionLines.push(line);
    }
  });

  return buildImportedPaper(paperInstructionLines, sections, problems);
}

function newQuestion(firstLine: string, lineNumber: number): DraftQuestion {
  const question: DraftQuestion = {
    lineNumber,
    textLines: [],
    marks: undefined,
    options: [],
    answerLetter: undefined,
    answerLineNumber: 0,
    modelAnswerLines: [],
    subPartCount: 0,
    subPartMarks: 0,
  };
  continueQuestion(question, firstLine);
  return question;
}

function continueQuestion(question: DraftQuestion, line: string): void {
  if (question.modelAnswerLines.length > 0) {
    question.modelAnswerLines.push(line);
    return;
  }
  const marksMatch = MARKS_AT_END.exec(line);
  const lineWithoutMarks = marksMatch ? line.slice(0, marksMatch.index) : line;
  if (marksMatch) question.marks = Number(marksMatch[1]);
  if (!lineWithoutMarks) return;

  if (question.options.length > 0) {
    const lastIndex = question.options.length - 1;
    question.options[lastIndex] = `${question.options[lastIndex]} ${lineWithoutMarks}`;
  } else {
    question.textLines.push(lineWithoutMarks);
  }
}

function setAnswer(question: DraftQuestion, answer: string, lineNumber: number): void {
  question.answerLineNumber = lineNumber;
  const letter = answer.replace(/[().]/g, '').trim();
  if (question.options.length > 0 && optionIndexOf(letter) !== undefined) {
    question.answerLetter = letter;
  } else if (question.options.length > 0) {
    question.answerLetter = letter || '?';
  } else if (answer.trim()) {
    question.modelAnswerLines.push(answer.trim());
  }
}

function isNextOption(letter: string, question: DraftQuestion): boolean {
  if (question.answerLetter !== undefined || question.modelAnswerLines.length > 0) return false;
  return optionIndexOf(letter) === question.options.length;
}

function isNextSubPart(line: string, letter: string, question: DraftQuestion): boolean {
  return (
    question.options.length === 0 &&
    question.modelAnswerLines.length === 0 &&
    MARKS_AT_END.test(line) &&
    optionIndexOf(letter) === question.subPartCount
  );
}

function addSubPart(question: DraftQuestion, line: string): void {
  question.textLines.push(line);
  question.subPartCount += 1;
  question.subPartMarks += Number(MARKS_AT_END.exec(line)?.[1] ?? 0);
}

function buildImportedPaper(
  paperInstructionLines: string[],
  draftSections: DraftSection[],
  problems: PaperProblem[],
): ImportedPaper {
  const warnings: PaperProblem[] = [];
  const answerKey: AnswerKey = {};
  let questionIndex = 0;

  const sections: PaperSection[] = draftSections
    .filter((section) => section.questions.length > 0 || section.title)
    .map((draftSection) => ({
      title: draftSection.title,
      instructions: draftSection.instructionLines.join('\n'),
      questions: draftSection.questions.map((draft) => {
        const question = toQuestion(draft, questionIndex);
        questionIndex += 1;
        collectAnswer(draft, question, answerKey, problems);
        if (marksOf(draft) === undefined) {
          warnings.push({
            lineNumber: draft.lineNumber,
            message: `no marks given, so question ${questionIndex} counts ${DEFAULT_MARKS} mark.`,
          });
        }
        if (question.options.length === 1) {
          problems.push({
            lineNumber: draft.lineNumber,
            message: `a multiple choice question needs at least ${paperLimits.minOptions} options.`,
          });
        }
        return question;
      }),
    }));

  const paper: Paper = { instructions: paperInstructionLines.join('\n'), sections };
  if (questionIndex === 0) {
    problems.push({
      lineNumber: 0,
      message: 'No questions found. Start each question with 1. or Q1.',
    });
  }
  const allProblems = problems.length > 0 || questionIndex === 0 ? problems : schemaProblems(paper);
  return { paper, answerKey, problems: allProblems, warnings };
}

function toQuestion(draft: DraftQuestion, questionIndex: number): PaperQuestion {
  return {
    id: questionIdFor(questionIndex),
    kind: draft.options.length > 0 ? 'mcq' : 'written',
    text: draft.textLines.join('\n'),
    marks: marksOf(draft) ?? DEFAULT_MARKS,
    options: draft.options,
    imageNumber: null,
  };
}

function marksOf(draft: DraftQuestion): number | undefined {
  return draft.marks ?? (draft.subPartMarks > 0 ? draft.subPartMarks : undefined);
}

function collectAnswer(
  draft: DraftQuestion,
  question: PaperQuestion,
  answerKey: AnswerKey,
  problems: PaperProblem[],
): void {
  if (draft.answerLetter !== undefined) {
    const option = optionIndexOf(draft.answerLetter);
    if (option === undefined || option >= question.options.length) {
      problems.push({
        lineNumber: draft.answerLineNumber,
        message: `the answer must be one of the option letters A to ${optionLetter(question.options.length - 1)}.`,
      });
      return;
    }
    answerKey[question.id] = { option };
  } else if (draft.modelAnswerLines.length > 0) {
    answerKey[question.id] = { text: draft.modelAnswerLines.join('\n') };
  }
}

export function paperToText(paper: Paper, answerKey: AnswerKey): string {
  const blocks: string[] = [];
  if (paper.instructions) blocks.push(paper.instructions);
  let number = 0;

  for (const section of paper.sections) {
    if (section.title) blocks.push(`# ${section.title}`);
    if (section.instructions) blocks.push(section.instructions);
    for (const question of section.questions) {
      number += 1;
      blocks.push(questionToText(question, number, answerKey[question.id]));
    }
  }
  return `${blocks.join('\n\n')}\n`;
}

function questionToText(
  question: PaperQuestion,
  number: number,
  answer: AnswerKey[string] | undefined,
): string {
  const marksLabel = question.marks === 1 ? '1 mark' : `${question.marks} marks`;
  const [firstLine, ...otherLines] = question.text.split('\n');
  const lines = [`${number}. ${firstLine} [${marksLabel}]`, ...otherLines];
  question.options.forEach((option, optionIndex) => {
    lines.push(`${optionLetter(optionIndex).toLowerCase()}) ${option}`);
  });
  if (answer?.option !== undefined)
    lines.push(`Answer: ${optionLetter(answer.option).toLowerCase()}`);
  if (answer?.text) lines.push(`Answer: ${answer.text}`);
  return lines.join('\n');
}
