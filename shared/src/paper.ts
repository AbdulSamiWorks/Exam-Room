export type AnswerKind = 'mcq' | 'written' | 'short' | 'blanks';

export type QuestionKind = AnswerKind | 'parts';

export type PartKind = Exclude<AnswerKind, 'mcq'>;

export type QuestionPart = {
  id: string;
  kind: PartKind;
  text: string;
  marks: number;
  options: string[];
};

export type PaperQuestion = {
  id: string;
  kind: QuestionKind;
  text: string;
  marks: number;
  options: string[];
  imageNumber: number | null;
  parts?: QuestionPart[];
};

export type PaperSection = {
  title: string;
  instructions: string;
  questions: PaperQuestion[];
};

export type Paper = {
  instructions: string;
  sections: PaperSection[];
};

export type QuestionAnswer = {
  option?: number;
  text?: string;
  accepted?: string[];
  blanks?: string[][];
};

export type AnswerKey = Record<string, QuestionAnswer>;

export type PaperKind = 'pages' | 'typed' | 'none';

export type WrittenAnswers = 'on_paper' | 'typed' | 'photos' | 'typed_and_photos';

export type NumberedQuestion = PaperQuestion & {
  number: number;
  sectionIndex: number;
};

export type MarkableUnit = Omit<QuestionPart, 'kind'> & {
  kind: AnswerKind;
  questionId: string;
  questionNumber: number;
  partLetter: string | null;
  label: string;
};

export type AnswerSlot = {
  slotId: string;
  unit: MarkableUnit;
  blankIndex: number | null;
};

export type TeacherPaperResponse = {
  paper: Paper | null;
  answerKey: AnswerKey;
  imageCount: number;
};

export type AnswerKeyRequest = {
  answerKey: AnswerKey;
};

export type StudentPaperResponse = {
  paper: Paper;
  shuffleSeed: number | null;
};

export type PaperLimits = {
  maxQuestions: 200;
  maxSections: 20;
  minOptions: 2;
  maxOptions: 6;
  maxQuestionTextLength: 2000;
  maxOptionTextLength: 500;
  maxTitleLength: 200;
  maxInstructionsLength: 2000;
  maxModelAnswerLength: 2000;
  maxMarksPerQuestion: 100;
  maxPaperImages: 20;
  maxPaperImageBytes: 1_000_000;
  maxParts: 26;
  maxBlanks: 30;
  maxAcceptedAnswers: 10;
  maxAcceptedAnswerLength: 500;
};
