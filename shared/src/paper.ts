export type QuestionKind = 'mcq' | 'written';

export type PaperQuestion = {
  id: string;
  kind: QuestionKind;
  text: string;
  marks: number;
  options: string[];
  imageNumber: number | null;
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
};

export type AnswerKey = Record<string, QuestionAnswer>;

export type PaperKind = 'pages' | 'typed' | 'none';

export type WrittenAnswers = 'on_paper' | 'typed' | 'photos' | 'typed_and_photos';

export type NumberedQuestion = PaperQuestion & {
  number: number;
  sectionIndex: number;
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
};
