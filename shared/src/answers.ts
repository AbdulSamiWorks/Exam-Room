export type AnswerChange = {
  questionId: string;
  choice: number | null;
  text: string | null;
  sequence: number;
  answeredAt: number;
};

export type SaveAnswersRequest = {
  answers: AnswerChange[];
};

export type SaveAnswersResponse = {
  savedCount: number;
  tooLateCount: number;
  serverTime: number;
};

export type StoredAnswer = {
  questionId: string;
  choice: number | null;
  text: string | null;
  sequence: number;
};

export type StoredAnswersResponse = {
  answers: StoredAnswer[];
};

export type AnswerLimits = {
  maxAnswersPerRequest: 200;
  maxTextLength: 5000;
};
