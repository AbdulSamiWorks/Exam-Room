import type {
  AnswerKey,
  Paper,
  PaperQuestion,
  PaperSection,
  QuestionAnswer,
  QuestionPart,
} from '@exam-room/shared';
import {
  blankCountOf,
  optionIndexOf,
  optionLetter,
  paperLimits,
  partIdOf,
  partLetter,
} from '@exam-room/shared/paper-rules';
import {
  ANSWER_ALTERNATIVES_SEPARATOR,
  BLANK_ANSWERS_SEPARATOR,
  DEFAULT_MARKS,
  questionIdFor,
  schemaProblems,
  splitAlternatives,
  splitBlankAnswers,
  splitPartMarks,
  type ImportedPaper,
  type PaperProblem,
} from './imported-paper';

const SECTION_LINE = /^#+\s*(.*)$/;
const NAMED_SECTION_LINE = /^((?:section|part)\s+[a-z0-9]{1,3}\s*[:.\-–—]\s*.*)$/i;
const QUESTION_LINE = /^(?:Q(?:uestion)?\s*)?(\d{1,3})\s*[.):]\s*(.+)$/i;
const OPTION_LINE = /^\(?([a-f])[.)]\s+(.+)$/i;
const PART_LINE = /^\(?([a-z])[.)]\s+(.+)$/i;
const MODEL_ANSWER_LINE = /^model\s+answer\s*[:-]\s*(.*)$/i;
const ANSWER_LINE = /^(?:answer|ans|correct answer)\s*[:-]\s*(.*)$/i;
const ANSWER_LETTER = /^\(?([a-f])(?:[).](?:\s.*)?)?$/i;
const INLINE_OPTION_MARKER = /(?:^|\s)\(?([a-f])\)\s+/gi;
const FILL_IN_BLANKS = /_{3,}/;
const WRITTEN_SECTION_TITLE = /short|long|detailed|descriptive|subjective|written|essay/i;
const MARKS_AT_END = /\s*[[(]\s*(\d+(?:\.5)?)\s*(?:marks?|m)?\s*[\])]\s*$/i;
const WORD = /\S+/g;
const LONG_EXACT_ANSWER_WORDS = 25;

type AnswerStyle = 'exact' | 'model';

type DraftAnswer = {
  style: AnswerStyle;
  lines: string[];
  lineNumber: number;
};

type DraftPart = {
  lineNumber: number;
  textLines: string[];
  marks: number | undefined;
  answer: DraftAnswer | undefined;
};

type DraftQuestion = {
  lineNumber: number;
  number: number;
  textLines: string[];
  marks: number | undefined;
  options: string[];
  firstPartLineNumber: number;
  answerLetter: string | undefined;
  answerLineNumber: number;
  hasModelAnswer: boolean;
  modelAnswerLines: string[];
  exactAnswer: DraftAnswer | undefined;
  subPartCount: number;
  subPartMarks: number;
  firstSubPartIndex: number;
  parts: DraftPart[];
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

    const sectionMatch = SECTION_LINE.exec(line) ?? NAMED_SECTION_LINE.exec(line);
    if (sectionMatch) {
      sections.push({ title: sectionMatch[1] ?? '', instructionLines: [], questions: [] });
      currentQuestion = undefined;
      return;
    }

    const questionMatch = QUESTION_LINE.exec(line);
    const questionNumber = Number(questionMatch?.[1]);
    if (questionMatch && startsNewQuestion(currentQuestion, questionNumber)) {
      currentQuestion = newQuestion(questionMatch[2] ?? '', questionNumber, lineNumber);
      currentSection().questions.push(currentQuestion);
      return;
    }

    const answerLine = readAnswerLine(line);
    if (answerLine) {
      if (!currentQuestion) {
        problems.push({ lineNumber, message: 'this answer comes before any question.' });
        return;
      }
      addAnswer(currentQuestion, answerLine, lineNumber, problems);
      return;
    }

    if (currentQuestion && currentQuestion.parts.length > 0) {
      continueParts(currentQuestion, line, lineNumber);
      return;
    }

    const inlineOptions = splitInlineOptions(line);
    if (inlineOptions && currentQuestion && isNextOption('a', currentQuestion)) {
      notePartLine(currentQuestion, lineNumber);
      currentQuestion.options.push(...inlineOptions);
      return;
    }

    const optionMatch = OPTION_LINE.exec(line);
    if (
      optionMatch &&
      currentQuestion &&
      isNextSubPart(line, optionMatch[1] ?? '', currentQuestion)
    ) {
      addSubPart(currentQuestion, line, lineNumber);
      return;
    }
    if (optionMatch && currentQuestion && isNextOption(optionMatch[1] ?? '', currentQuestion)) {
      notePartLine(currentQuestion, lineNumber);
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
    } else if (!FILL_IN_BLANKS.test(line)) {
      paperInstructionLines.push(line);
    }
  });

  return buildImportedPaper(paperInstructionLines, sections, problems);
}

type AnswerLine = {
  style: AnswerStyle;
  text: string;
};

function readAnswerLine(line: string): AnswerLine | undefined {
  const modelMatch = MODEL_ANSWER_LINE.exec(line);
  if (modelMatch) return { style: 'model', text: (modelMatch[1] ?? '').trim() };
  const answerMatch = ANSWER_LINE.exec(line);
  return answerMatch ? { style: 'exact', text: (answerMatch[1] ?? '').trim() } : undefined;
}

function startsNewQuestion(question: DraftQuestion | undefined, number: number): boolean {
  if (!question) return true;
  const isInsideLongAnswer =
    question.hasModelAnswer ||
    question.exactAnswer !== undefined ||
    question.parts.at(-1)?.answer?.style === 'model';
  return !isInsideLongAnswer || number === question.number + 1;
}

function splitInlineOptions(line: string): string[] | undefined {
  const markers = [...line.matchAll(INLINE_OPTION_MARKER)];
  const inOrder = markers.filter(
    (marker, markerIndex) => optionIndexOf(marker[1] ?? '') === markerIndex,
  );
  if (inOrder.length < 2 || inOrder.length !== markers.length || markers[0]?.index !== 0) {
    return undefined;
  }
  const options = inOrder.map((marker, markerIndex) => {
    const start = (marker.index ?? 0) + marker[0].length;
    const end = inOrder[markerIndex + 1]?.index ?? line.length;
    return line.slice(start, end).trim();
  });
  return options.every(Boolean) ? options : undefined;
}

function newQuestion(firstLine: string, number: number, lineNumber: number): DraftQuestion {
  const question: DraftQuestion = {
    lineNumber,
    number,
    textLines: [],
    marks: undefined,
    options: [],
    firstPartLineNumber: lineNumber,
    answerLetter: undefined,
    answerLineNumber: 0,
    hasModelAnswer: false,
    modelAnswerLines: [],
    exactAnswer: undefined,
    subPartCount: 0,
    subPartMarks: 0,
    firstSubPartIndex: -1,
    parts: [],
  };
  continueQuestion(question, firstLine);
  return question;
}

function notePartLine(question: DraftQuestion, lineNumber: number): void {
  if (question.options.length === 0 && question.subPartCount === 0) {
    question.firstPartLineNumber = lineNumber;
  }
}

function continueQuestion(question: DraftQuestion, line: string): void {
  if (question.hasModelAnswer) {
    question.modelAnswerLines.push(line);
    return;
  }
  if (question.exactAnswer) {
    question.exactAnswer.lines.push(line);
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

function addAnswer(
  question: DraftQuestion,
  answerLine: AnswerLine,
  lineNumber: number,
  problems: PaperProblem[],
): void {
  if (question.parts.length === 0 && canStartParts(question, answerLine)) startParts(question);
  const currentPart = question.parts.at(-1);
  if (currentPart) {
    if (currentPart.answer) {
      problems.push({ lineNumber, message: 'this part already has an answer.' });
      return;
    }
    currentPart.answer = { style: answerLine.style, lines: [answerLine.text], lineNumber };
    return;
  }
  if (
    question.answerLetter !== undefined ||
    question.hasModelAnswer ||
    question.exactAnswer !== undefined
  ) {
    problems.push({ lineNumber, message: 'this question already has an answer.' });
    return;
  }
  setAnswer(question, answerLine, lineNumber);
}

function canStartParts(question: DraftQuestion, answerLine: AnswerLine): boolean {
  if (question.answerLetter !== undefined || question.hasModelAnswer || question.exactAnswer) {
    return false;
  }
  if (question.options.length === 1 && question.subPartCount === 0) {
    return answerLine.style === 'model' || !ANSWER_LETTER.test(answerLine.text);
  }
  return question.options.length === 0 && question.subPartCount === 1;
}

function startParts(question: DraftQuestion): void {
  if (question.options.length === 1) {
    question.parts.push(
      newPart(`a) ${question.options[0] ?? ''}`, question.firstPartLineNumber) ?? emptyPart(),
    );
    question.options = [];
    return;
  }
  const [subPartLine = '', ...followingLines] = question.textLines.splice(
    question.firstSubPartIndex,
  );
  const part = newPart(subPartLine, question.firstPartLineNumber) ?? emptyPart();
  part.textLines.push(...followingLines);
  question.parts.push(part);
  question.subPartCount = 0;
  question.subPartMarks = 0;
}

function newPart(line: string, lineNumber: number): DraftPart | undefined {
  const partText = PART_LINE.exec(line)?.[2];
  if (partText === undefined) return undefined;
  const marksMatch = MARKS_AT_END.exec(partText);
  return {
    lineNumber,
    textLines: [marksMatch ? partText.slice(0, marksMatch.index) : partText],
    marks: marksMatch ? Number(marksMatch[1]) : undefined,
    answer: undefined,
  };
}

function emptyPart(): DraftPart {
  return { lineNumber: 0, textLines: [], marks: undefined, answer: undefined };
}

function continueParts(question: DraftQuestion, line: string, lineNumber: number): void {
  const partMatch = PART_LINE.exec(line);
  const isNextPart =
    partMatch !== null && partLetter(question.parts.length) === partMatch[1]?.toLowerCase();
  const part = isNextPart ? newPart(line, lineNumber) : undefined;
  if (part) {
    question.parts.push(part);
    return;
  }
  const currentPart = question.parts.at(-1);
  if (!currentPart) return;
  if (currentPart.answer) {
    currentPart.answer.lines.push(line);
    return;
  }
  const marksMatch = MARKS_AT_END.exec(line);
  if (marksMatch) currentPart.marks = Number(marksMatch[1]);
  const lineWithoutMarks = marksMatch ? line.slice(0, marksMatch.index) : line;
  if (lineWithoutMarks) currentPart.textLines.push(lineWithoutMarks);
}

function setAnswer(question: DraftQuestion, answerLine: AnswerLine, lineNumber: number): void {
  question.answerLineNumber = lineNumber;
  const answerText = answerLine.text;
  const letter = ANSWER_LETTER.exec(answerText)?.[1];
  const isExact = answerLine.style === 'exact';
  if (isExact && question.options.length > 0 && letter) {
    question.answerLetter = letter;
  } else if (isExact && question.options.length > 0 && !/\s/.test(answerText)) {
    question.answerLetter = answerText || '?';
  } else if (isExact && question.options.length === 0 && hasBlanks(question.textLines)) {
    question.exactAnswer = { style: 'exact', lines: [answerText], lineNumber };
  } else {
    turnOptionsIntoParts(question);
    question.hasModelAnswer = true;
    if (answerText) question.modelAnswerLines.push(answerText);
  }
}

function hasBlanks(textLines: readonly string[]): boolean {
  return textLines.some((line) => FILL_IN_BLANKS.test(line));
}

function turnOptionsIntoParts(question: DraftQuestion): void {
  question.options.forEach((option, optionIndex) => {
    question.textLines.push(`${optionLetter(optionIndex).toLowerCase()}) ${option}`);
  });
  question.options = [];
}

function isNextOption(letter: string, question: DraftQuestion): boolean {
  if (question.answerLetter !== undefined || question.hasModelAnswer || question.exactAnswer) {
    return false;
  }
  return optionIndexOf(letter) === question.options.length;
}

function isNextSubPart(line: string, letter: string, question: DraftQuestion): boolean {
  return (
    question.options.length === 0 &&
    !question.hasModelAnswer &&
    question.exactAnswer === undefined &&
    MARKS_AT_END.test(line) &&
    optionIndexOf(letter) === question.subPartCount
  );
}

function addSubPart(question: DraftQuestion, line: string, lineNumber: number): void {
  if (question.subPartCount === 0) {
    question.firstSubPartIndex = question.textLines.length;
    question.firstPartLineNumber = lineNumber;
  }
  question.textLines.push(line);
  question.subPartCount += 1;
  question.subPartMarks += Number(MARKS_AT_END.exec(line)?.[1] ?? 0);
}

type BuildNotes = {
  problems: PaperProblem[];
  warnings: PaperProblem[];
};

function buildImportedPaper(
  paperInstructionLines: string[],
  draftSections: DraftSection[],
  problems: PaperProblem[],
): ImportedPaper {
  const notes: BuildNotes = { problems, warnings: [] };
  const answerKey: AnswerKey = {};
  let questionIndex = 0;

  const sections: PaperSection[] = draftSections
    .filter((section) => section.questions.length > 0 || section.title)
    .map((draftSection) => ({
      title: draftSection.title,
      instructions: draftSection.instructionLines.join('\n'),
      questions: draftSection.questions.map((draft) => {
        if (WRITTEN_SECTION_TITLE.test(draftSection.title) && draft.answerLetter === undefined) {
          turnOptionsIntoParts(draft);
        }
        const question = toQuestion(draft, questionIdFor(questionIndex), notes);
        questionIndex += 1;
        collectAnswers(draft, question, answerKey, notes);
        if (marksOf(draft) === undefined && draft.parts.every((part) => !part.marks)) {
          notes.warnings.push({
            lineNumber: draft.lineNumber,
            message: `no marks given, so question ${questionIndex} counts ${question.marks} ${question.marks === 1 ? 'mark' : 'marks'}.`,
          });
        }
        if (question.options.length === 1) {
          notes.problems.push({
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
  return { paper, answerKey, problems: allProblems, warnings: notes.warnings };
}

function toQuestion(draft: DraftQuestion, id: string, notes: BuildNotes): PaperQuestion {
  const text = draft.textLines.join('\n');
  if (draft.parts.length > 0) return toPartsQuestion(draft, id, text, notes);
  return {
    id,
    kind: questionKindOf(draft),
    text,
    marks: marksOf(draft) ?? DEFAULT_MARKS,
    options: draft.options,
    imageNumber: null,
  };
}

function questionKindOf(draft: DraftQuestion): PaperQuestion['kind'] {
  if (draft.options.length > 0) return 'mcq';
  return draft.exactAnswer ? 'blanks' : 'written';
}

function toPartsQuestion(
  draft: DraftQuestion,
  id: string,
  text: string,
  notes: BuildNotes,
): PaperQuestion {
  const { partMarks, totalMarks, problem } = splitPartMarks(
    draft.marks,
    draft.parts.map((part) => part.marks),
  );
  if (problem) notes.problems.push({ lineNumber: draft.lineNumber, message: problem });
  const parts: QuestionPart[] = draft.parts.map((part, partIndex) => {
    const partText = part.textLines.join('\n');
    return {
      id: partIdOf(id, partIndex),
      kind: partKindOf(part, partText),
      text: partText,
      marks: partMarks[partIndex] ?? DEFAULT_MARKS,
      options: [],
    };
  });
  return { id, kind: 'parts', text, marks: totalMarks, options: [], imageNumber: null, parts };
}

function partKindOf(part: DraftPart, partText: string): QuestionPart['kind'] {
  if (part.answer?.style === 'model') return 'written';
  return FILL_IN_BLANKS.test(partText) ? 'blanks' : 'short';
}

function marksOf(draft: DraftQuestion): number | undefined {
  return draft.marks ?? (draft.subPartMarks > 0 ? draft.subPartMarks : undefined);
}

function collectAnswers(
  draft: DraftQuestion,
  question: PaperQuestion,
  answerKey: AnswerKey,
  notes: BuildNotes,
): void {
  if (question.kind === 'parts') {
    draft.parts.forEach((part, partIndex) => {
      const unit = question.parts?.[partIndex];
      if (!unit || !part.answer) return;
      const answer = keyOf(unit.kind, unit.text, part.answer, notes);
      if (answer) answerKey[unit.id] = answer;
    });
    return;
  }
  if (draft.answerLetter !== undefined) {
    const option = optionIndexOf(draft.answerLetter);
    if (option === undefined || option >= question.options.length) {
      notes.problems.push({
        lineNumber: draft.answerLineNumber,
        message: `the answer must be one of the option letters A to ${optionLetter(question.options.length - 1)}.`,
      });
      return;
    }
    answerKey[question.id] = { option };
  } else if (draft.exactAnswer) {
    const answer = keyOf('blanks', question.text, draft.exactAnswer, notes);
    if (answer) answerKey[question.id] = answer;
  } else if (draft.modelAnswerLines.length > 0) {
    answerKey[question.id] = { text: draft.modelAnswerLines.join('\n') };
  }
}

function keyOf(
  kind: PaperQuestion['kind'],
  text: string,
  draftAnswer: DraftAnswer,
  notes: BuildNotes,
): QuestionAnswer | undefined {
  if (draftAnswer.style === 'model') {
    const modelAnswer = draftAnswer.lines.join('\n').trim();
    return modelAnswer ? { text: modelAnswer } : undefined;
  }
  const answer = draftAnswer.lines.join(' ').trim();
  if (!answer) return undefined;
  if (kind === 'blanks') {
    const blankCount = blankCountOf(text);
    const blanks = splitBlankAnswers(answer, blankCount);
    if (blanks.length !== blankCount || blanks.some((accepted) => accepted.length === 0)) {
      notes.problems.push({
        lineNumber: draftAnswer.lineNumber,
        message: `there are ${blankCount} blanks but ${blanks.length} answers. Give one answer for each blank, in order, separated by ${BLANK_ANSWERS_SEPARATOR}`,
      });
      return undefined;
    }
    return { blanks };
  }
  noteLongExactAnswer(answer, draftAnswer.lineNumber, notes);
  return { accepted: splitAlternatives(answer) };
}

function noteLongExactAnswer(answer: string, lineNumber: number, notes: BuildNotes): void {
  const wordCount = answer.match(WORD)?.length ?? 0;
  if (wordCount <= LONG_EXACT_ANSWER_WORDS) return;
  notes.warnings.push({
    lineNumber,
    message:
      'this answer is long, and the app checks it word by word. If students may answer in their own words, write Model answer: instead.',
  });
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
      blocks.push(questionToText(question, number, answerKey));
    }
  }
  return `${blocks.join('\n\n')}\n`;
}

export function canWriteAsText(paper: Paper): boolean {
  return paper.sections.every((section) =>
    section.questions.every((question) => question.kind !== 'short'),
  );
}

function questionToText(question: PaperQuestion, number: number, answerKey: AnswerKey): string {
  const [firstLine, ...otherLines] = question.text.split('\n');
  const lines = [
    `${number}. ${firstLine} [${describeMarksForText(question.marks)}]`,
    ...otherLines,
  ];
  question.options.forEach((option, optionIndex) => {
    lines.push(`${optionLetter(optionIndex).toLowerCase()}) ${option}`);
  });
  const parts = question.parts ?? [];
  const showsPartMarks = new Set(parts.map((part) => part.marks)).size > 1;
  parts.forEach((part, partIndex) => {
    const [partFirstLine, ...partOtherLines] = part.text.split('\n');
    const partMarks = showsPartMarks ? ` [${part.marks}]` : '';
    lines.push(`${partLetter(partIndex)}) ${partFirstLine}${partMarks}`, ...partOtherLines);
    lines.push(...answerLines(part.kind, answerKey[part.id], true));
  });
  if (question.kind !== 'parts') {
    lines.push(...answerLines(question.kind, answerKey[question.id], false));
  }
  return lines.join('\n');
}

function describeMarksForText(marks: number): string {
  return marks === 1 ? '1 mark' : `${marks} marks`;
}

function answerLines(
  kind: PaperQuestion['kind'],
  answer: QuestionAnswer | undefined,
  isPart: boolean,
): string[] {
  if (answer?.option !== undefined) return [`Answer: ${optionLetter(answer.option).toLowerCase()}`];
  if (kind === 'blanks') {
    const blanks = (answer?.blanks ?? []).map((accepted) =>
      accepted.join(` ${ANSWER_ALTERNATIVES_SEPARATOR} `),
    );
    return [`Answer: ${blanks.join(`${BLANK_ANSWERS_SEPARATOR} `)}`.trimEnd()];
  }
  if (kind === 'short') {
    const accepted = answer?.accepted ?? [];
    return [`Answer: ${accepted.join(` ${ANSWER_ALTERNATIVES_SEPARATOR} `)}`.trimEnd()];
  }
  if (isPart) return [`Model answer: ${answer?.text ?? ''}`.trimEnd()];
  return answer?.text ? [`Answer: ${answer.text}`] : [];
}
