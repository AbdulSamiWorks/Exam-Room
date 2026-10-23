import type { ChapterSummary } from './chapters.js';

export type SchoolClass = {
  id: number;
  name: string;
};

export type ClassSubjectSummary = {
  id: number;
  name: string;
  testCount: number;
  chapters: ChapterSummary[];
};

export type ClassSummary = SchoolClass & {
  studentCount: number;
  subjects: ClassSubjectSummary[];
};

export type ClassListResponse = {
  classes: ClassSummary[];
};

export type ClassNameRequest = {
  name: string;
};

export type ClassResponse = {
  schoolClass: SchoolClass;
};

export type ClassLimits = {
  maxNameLength: 40;
};
