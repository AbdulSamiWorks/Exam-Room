import type { AnswerKey, Paper } from './paper.js';
import type { StoredAnswer } from './answers.js';
import type { AttemptStatus, FinishReason } from './attempts.js';

export type QuestionMark = {
  marks: number | null;
  comment: string;
};

export type AttemptScore = {
  mcqMarks: number;
  writtenMarks: number;
  totalMarks: number;
  correctCount: number;
  mcqCount: number;
  markedWrittenCount: number;
  writtenCount: number;
};

export type ReleaseOptions = {
  showCorrectAnswers: boolean;
  showComments: boolean;
  showTopScorer: boolean;
};

export type AttemptMarking = {
  attemptId: number;
  studentName: string;
  rollNumber: string;
  status: AttemptStatus;
  finishReason: FinishReason | null;
  answers: StoredAnswer[];
  questionMarks: Record<string, QuestionMark>;
  comment: string;
  photoCount: number;
  score: AttemptScore;
};

export type MarkingResponse = {
  paper: Paper | null;
  answerKey: AnswerKey;
  maxMarks: number;
  attempts: AttemptMarking[];
  releasedAt: number | null;
  releaseOptions: ReleaseOptions;
};

export type SaveMarksRequest = {
  questionMarks: Record<string, QuestionMark>;
  comment: string;
};

export type AttemptMarkingResponse = {
  attempt: AttemptMarking;
};

export type ReleaseResultsRequest = ReleaseOptions;

export type ReleaseResultsResponse = {
  releasedAt: number | null;
  releaseOptions: ReleaseOptions;
};

export type QuestionResult = {
  questionId: string;
  marks: number | null;
  chosenOption: number | null;
  typedAnswer: string | null;
  correctOption: number | null;
  modelAnswer: string | null;
  comment: string;
};

export type StudentResultResponse = {
  isFinal: boolean;
  testTitle: string;
  subjectName: string;
  paper: Paper | null;
  maxMarks: number;
  totalMarks: number;
  questions: QuestionResult[];
  comment: string;
  topScorers: string[] | null;
  releasedAt: number | null;
};
