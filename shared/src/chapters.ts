export type Chapter = {
  id: number;
  subjectId: number;
  name: string;
  position: number;
};

export type ChapterSummary = Omit<Chapter, 'subjectId'> & {
  testCount: number;
};

export type ChapterTag = {
  id: number;
  name: string;
};

export type ChapterNameRequest = {
  name: string;
};

export type ChapterResponse = {
  chapter: Chapter;
};

export type ChapterOrderRequest = {
  chapterIds: number[];
};

export type ChapterLimits = {
  maxNameLength: 80;
  maxChaptersPerSubject: 100;
};
