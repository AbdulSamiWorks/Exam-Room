import type { SchoolClass } from './classes.js';

export type StudentProfile = {
  id: number;
  name: string;
  rollNumber: string;
  schoolClass: SchoolClass;
};

export type StudentSessionResponse = {
  student: StudentProfile | null;
};

export type StudentLoginRequest = {
  classId: number;
  rollNumber: string;
  pin: string;
};

export type LoginClassListResponse = {
  classes: SchoolClass[];
};
